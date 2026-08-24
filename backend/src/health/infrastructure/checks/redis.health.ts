import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { RedisClientFactory } from '../../../common/redis/public-api';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {
    super();
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    const url =
      this.config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      this.config.get<string>('SESSION_STORE_REDIS_URL');
    if (!url) {
      return this.getStatus(key, true, {
        message: 'Redis non configuré',
      });
    }

    let client: Redis | null = null;
    try {
      client = this.redisFactory.create(url, 'health:redis', {
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      await client.quit();
      return this.getStatus(key, true);
    } catch (error) {
      if (client) {
        try {
          client.disconnect();
        } catch {
          /* ignore */
        }
      }
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
