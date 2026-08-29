import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import type {
  GameScheduledTask,
  GameTaskProcessor,
  GameTaskScheduler,
} from '../../application/ports/game-task-scheduler.port';
import { GameEngineMetricsService } from '../../application/services/game-engine-metrics.service';

const QUEUE_NAME = 'game-engine-tasks';
const ATTEMPTS = 5;

@Injectable()
export class BullmqGameTaskSchedulerService
  implements GameTaskScheduler, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqGameTaskSchedulerService.name);
  private readonly connection: Redis | null;
  private readonly queue: Queue<GameScheduledTask> | null;
  private worker: Worker<GameScheduledTask> | null = null;

  constructor(
    config: ConfigService,
    private readonly metrics: GameEngineMetricsService,
  ) {
    const redisUrl =
      config.get<string>('GAME_TASK_REDIS_URL') ??
      config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      config.get<string>('SESSION_STORE_REDIS_URL');
    this.connection = redisUrl
      ? new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: true,
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
            attempts: ATTEMPTS,
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
    if (!this.connection || this.worker) return;
    this.worker = new Worker<GameScheduledTask>(
      QUEUE_NAME,
      async (job) => {
        const startedAtMs = Date.now();
        this.metrics.recordTimerExecution(
          job.data.gameType,
          Math.max(0, startedAtMs - job.data.dueAtMs),
        );
        await processor(job.data);
      },
      { connection: this.connection, concurrency: 16 },
    );
    this.worker.on('failed', (job, error) => {
      if (!job) return;
      const terminal = job.attemptsMade >= (job.opts.attempts ?? ATTEMPTS);
      this.metrics.recordTimerFailure(job.data.gameType, terminal);
      this.logger.error(
        JSON.stringify({
          event: terminal ? 'game.task.dead-letter' : 'game.task.retry',
          jobId: job.id,
          roomId: job.data.roomId,
          gameType: job.data.gameType,
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
    if (!this.queue) return;
    const jobId = this.jobId(task);
    const existing = await this.queue.getJob(jobId);
    if (existing) return;
    await this.removeSuperseded(task);
    await this.queue.add('execute', task, {
      jobId,
      delay: Math.max(0, task.dueAtMs - Date.now()),
    });
    this.metrics.recordTimerScheduled(task.gameType);
  }

  async cancel(key: string): Promise<void> {
    if (!this.queue) return;
    const jobs = await this.pendingJobs();
    await Promise.all(
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
    const jobs = await this.pendingJobs();
    await Promise.all(
      jobs
        .filter((job) => job.data.roomId === roomId)
        .map(async (job) => {
          await this.removeIfPossible(job);
          this.metrics.recordTimerCancelled(job.data.gameType);
        }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private jobId(task: GameScheduledTask): string {
    const signature = createHash('sha256')
      .update(task.signature)
      .digest('hex')
      .slice(0, 16);
    const gameType = task.gameType.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `game-task--${task.roomId}--${gameType}--${task.generation}--${signature}`;
  }

  private async removeSuperseded(task: GameScheduledTask): Promise<void> {
    const jobs = await this.pendingJobs();
    await Promise.all(
      jobs
        .filter((job) => job.data.key === task.key)
        .map((job) => this.removeIfPossible(job)),
    );
  }

  private async pendingJobs(): Promise<Job<GameScheduledTask>[]> {
    return this.queue
      ? this.queue.getJobs(['delayed', 'waiting', 'prioritized'])
      : [];
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
