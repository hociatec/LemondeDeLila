import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { prometheusMetrics } from '../../../../platform/observability/public-api';
import {
  REDIS_READINESS_TIMEOUT_MS,
  withHealthCheckTimeout,
} from './health-check-timeout';

@Injectable()
export class BullmqHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(BullmqHealthIndicator.name);
  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {
    super();
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    if (typeof key !== 'string' || !key.trim() || key.length > 128) {
      throw new HealthCheckError(
        'Invalid health-check key',
        this.getStatus('bullmq', false),
      );
    }
    const url =
      this.config.get<string>('GAME_TASK_REDIS_URL') ??
      this.config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      this.config.get<string>('SESSION_STORE_REDIS_URL');
    if (!url) {
      throw new HealthCheckError(
        'BullMQ Redis not configured',
        this.getStatus(key, false),
      );
    }
    let connection: Redis | null = null;
    let queue: Queue | null = null;
    try {
      connection = this.redisFactory.create(url, 'health:bullmq', {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        connectTimeout: REDIS_READINESS_TIMEOUT_MS,
        commandTimeout: REDIS_READINESS_TIMEOUT_MS,
        retryStrategy: () => null,
      });
      queue = new Queue('game-engine-tasks', { connection });
      const counts = await withHealthCheckTimeout(
        queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      );
      prometheusMetrics.setBullmqJobs('game-engine-tasks', {
        waiting: counts.waiting,
        active: counts.active,
        delayed: counts.delayed,
        failed: counts.failed,
      });
      prometheusMetrics.setDependencyUp('bullmq', true);
      const queued = counts.waiting + counts.active + counts.delayed;
      prometheusMetrics.setDependencySaturation(
        'bullmq',
        'queued-jobs',
        queued / Math.max(1, queued + 100),
      );
      const configuredMaximumFailed = Number(
        this.config.get<number>('HEALTH_MAX_FAILED_JOBS', 100),
      );
      const maximumFailed =
        Number.isSafeInteger(configuredMaximumFailed) &&
        configuredMaximumFailed >= 0 &&
        configuredMaximumFailed <= 1_000_000
          ? configuredMaximumFailed
          : 100;
      const status = this.getStatus(key, counts.failed <= maximumFailed, {
        ...counts,
        maximumFailed,
      });
      if (counts.failed > maximumFailed) {
        throw new HealthCheckError('BullMQ failed-job limit exceeded', status);
      }
      return status;
    } catch (error) {
      prometheusMetrics.setDependencyUp('bullmq', false);
      if (error instanceof HealthCheckError) throw error;
      throw new HealthCheckError(
        'BullMQ check failed',
        this.getStatus(key, false, {
          message: 'File de tâches indisponible',
        }),
      );
    } finally {
      await this.closeProbe(queue, connection);
    }
  }

  private async closeProbe(queue: Queue | null, connection: Redis | null) {
    try {
      connection?.disconnect();
    } catch {
      this.logger.warn('bullmq_health_disconnect_failed');
    }
    try {
      if (queue) await withHealthCheckTimeout(queue.close());
    } catch {
      this.logger.warn('bullmq_health_queue_close_failed');
    }
  }
}
