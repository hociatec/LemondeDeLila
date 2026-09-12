import { allCompleted } from '../../../../shared/utils/public-api';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker, UnrecoverableError, DelayedError } from 'bullmq';
import { decodeGameScheduledTask } from '../../application/helpers/game-task-contract';
import Redis from 'ioredis';
import { gameTaskJobId, isSupersededGameTask } from './game-task-job-id';
import {
  currentCorrelationId,
  inSpan,
  normalizeCorrelationId,
  runWithCorrelationId,
} from '../../../../platform/observability/public-api';
import type {
  GameScheduledTask,
  GameTaskProcessor,
  GameTaskScheduler,
} from '../../application/ports/game-task-scheduler.port';
import { GameEngineMetricsService } from '../../application/services/game-engine-metrics.service';

const QUEUE_NAME = 'game-engine-tasks';
/** Automatic tasks are retried only through the stable, idempotent command path. */
const IDEMPOTENT_TASK_ATTEMPTS = 5;

@Injectable()
export class BullmqGameTaskSchedulerService
  implements GameTaskScheduler, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqGameTaskSchedulerService.name);
  private readonly connection: Redis | null;
  private readonly queue: Queue<GameScheduledTask> | null;
  private worker: Worker<GameScheduledTask> | null = null;
  private workerClosed: Promise<void> | undefined;

  constructor(
    config: ConfigService,
    private readonly metrics: GameEngineMetricsService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
    @Inject(ApplicationShutdownService)
    private readonly shutdown = new ApplicationShutdownService(),
  ) {
    shutdown.registerSource('game-task-worker', () => this.stopProcessing());
    const redisUrl =
      config.get<string>('GAME_TASK_REDIS_URL') ??
      config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      config.get<string>('SESSION_STORE_REDIS_URL');
    this.connection = redisUrl
      ? new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: 10_000,
          commandTimeout: 10_000,
        })
      : null;
    this.connection?.on('error', (error: Error) => {
      this.logger.error(
        JSON.stringify({
          event: 'game.task.redis.error',
          message: error.message,
        }),
      );
    });
    this.queue = this.connection
      ? new Queue<GameScheduledTask>(QUEUE_NAME, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: IDEMPOTENT_TASK_ATTEMPTS,
            backoff: { type: 'exponential', delay: 500 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        })
      : null;
    if (!this.queue) {
      this.logger.warn('game.task.scheduler.disabled: aucune URL Redis');
    }
  }

  registerProcessor(processor: GameTaskProcessor): void {
    if (!this.connection || this.worker || this.shutdown.isDraining) return;
    this.worker = new Worker<GameScheduledTask>(
      QUEUE_NAME,
      async (job, token) => {
        let task: GameScheduledTask;
        try {
          task = decodeGameScheduledTask(job.data);
        } catch {
          throw new UnrecoverableError('Invalid game scheduled task');
        }
        const startedAtMs = this.clock.now();
        if (task.dueAtMs > startedAtMs) {
          await job.moveToDelayed(task.dueAtMs, token);
          throw new DelayedError();
        }
        this.metrics.recordTimerExecution(
          task.gameType,
          Math.max(0, startedAtMs - task.dueAtMs),
        );
        await inSpan(
          'bullmq game-engine-tasks execute',
          {
            'messaging.system': 'bullmq',
            'messaging.destination.name': QUEUE_NAME,
            'messaging.operation.name': 'execute',
            'lila.game.type': task.gameType,
          },
          () =>
            runWithCorrelationId(
              normalizeCorrelationId(task.correlationId),
              () => processor(task),
            ),
        );
      },
      { connection: this.connection, concurrency: 16 },
    );
    this.worker.on('failed', (job, error) => {
      if (!job) return;
      let task: GameScheduledTask;
      try {
        task = decodeGameScheduledTask(job.data);
      } catch {
        this.logger.error(
          JSON.stringify({ event: 'game.task.invalid', jobId: job.id }),
        );
        return;
      }
      const terminal =
        error instanceof UnrecoverableError ||
        job.attemptsMade >= (job.opts.attempts ?? IDEMPOTENT_TASK_ATTEMPTS);
      this.metrics.recordTimerFailure(task.gameType, terminal);
      this.logger.error(
        JSON.stringify({
          event: terminal ? 'game.task.dead-letter' : 'game.task.retry',
          jobId: job.id,
          roomId: task.roomId,
          gameType: task.gameType,
          attemptsMade: job.attemptsMade,
          message: error.message,
        }),
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(
        JSON.stringify({
          event: 'game.task.worker.error',
          message: error.message,
        }),
      );
    });
  }

  async schedule(task: GameScheduledTask): Promise<void> {
    task = decodeGameScheduledTask(task);
    if (!this.queue) return;
    const correlatedTask = {
      ...task,
      correlationId:
        task.correlationId ??
        currentCorrelationId() ??
        normalizeCorrelationId(undefined),
    };
    const jobId = gameTaskJobId(correlatedTask);
    const existing = await this.queue.getJob(jobId);
    if (existing) return;
    await this.removeSuperseded(correlatedTask);
    await this.queue.add('execute', correlatedTask, {
      jobId,
      delay: Math.max(0, correlatedTask.dueAtMs - this.clock.now()),
    });
    this.metrics.recordTimerScheduled(correlatedTask.gameType);
  }

  async cancel(key: string): Promise<void> {
    if (!this.queue) return;
    if (typeof key !== 'string' || !key || key.length > 256) return;
    const jobs = await this.pendingJobs();
    await allCompleted(
      jobs
        .filter((job) => job.data.key === key)
        .map(async (job) => {
          await this.removeIfPossible(job);
          this.metrics.recordTimerCancelled(job.data.gameType);
        }),
    );
  }

  async cancelRoom(roomId: number): Promise<void> {
    if (!this.queue) return;
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return;
    const jobs = await this.pendingJobs();
    await allCompleted(
      jobs
        .filter((job) => job.data.roomId === roomId)
        .map(async (job) => {
          await this.removeIfPossible(job);
          this.metrics.recordTimerCancelled(job.data.gameType);
        }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopProcessing();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private stopProcessing(): Promise<void> {
    return (this.workerClosed ??= Promise.resolve(this.worker?.close()));
  }

  private async removeSuperseded(task: GameScheduledTask): Promise<void> {
    const jobs = await this.pendingJobs();
    await allCompleted(
      jobs
        .filter((job) => isSupersededGameTask(job.data, task))
        .map((job) => this.removeIfPossible(job)),
    );
  }

  private async pendingJobs(): Promise<Job<GameScheduledTask>[]> {
    const jobs = this.queue
      ? await this.queue.getJobs(['delayed', 'waiting', 'prioritized'])
      : [];
    return jobs.filter((job) => {
      try {
        decodeGameScheduledTask(job.data);
        return true;
      } catch {
        this.logger.warn(
          JSON.stringify({ event: 'game.task.invalid-pending', jobId: job.id }),
        );
        return false;
      }
    });
  }

  private async removeIfPossible(job: Job<GameScheduledTask>): Promise<void> {
    try {
      await job.remove();
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'game.task.cancel.deferred',
          jobId: job.id,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
