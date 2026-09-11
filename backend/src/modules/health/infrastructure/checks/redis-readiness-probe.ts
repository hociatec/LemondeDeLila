import type Redis from 'ioredis';
import type { RedisClientFactory } from '../../../../platform/redis/public-api';

import {
  REDIS_READINESS_TIMEOUT_MS,
  withHealthCheckTimeout,
} from './health-check-timeout';

export async function probeRedisReadiness(
  factory: RedisClientFactory,
  url: string,
): Promise<boolean> {
  let client: Redis | null = null;
  let active = true;
  try {
    client = factory.create(url, 'health:redis', {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: REDIS_READINESS_TIMEOUT_MS,
      commandTimeout: REDIS_READINESS_TIMEOUT_MS,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    const connection = client;
    return await withHealthCheckTimeout(
      (async () => {
        await connection.connect();
        return active && (await connection.ping()) === 'PONG';
      })(),
    );
  } catch {
    return false;
  } finally {
    active = false;
    try {
      client?.disconnect();
    } catch {
      // Cleanup failure must not replace the readiness result.
    }
  }
}
