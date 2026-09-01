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
        maxRetriesPerRequest: null,
      });
      queue = new Queue('game-engine-tasks', { connection });
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      const maximumFailed = this.config.get<number>(
        'HEALTH_MAX_FAILED_JOBS',
        100,
      );
      const status = this.getStatus(key, counts.failed <= maximumFailed, {
        ...counts,
        maximumFailed,
      });
      if (counts.failed > maximumFailed) {
        throw new HealthCheckError('BullMQ failed-job limit exceeded', status);
      }
      return status;
    } catch (error) {
      if (error instanceof HealthCheckError) throw error;
      throw new HealthCheckError(
        'BullMQ check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      try {
        await queue?.close();
      } catch (closeError) {
        this.logger.warn(
          `bullmq_health_queue_close_failed error=${closeError instanceof Error ? closeError.message : String(closeError)}`,
        );
      }
      if (connection?.status !== 'end') connection?.disconnect();
    }
  }
}
