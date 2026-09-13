import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { RedisClientFactory } from './redis-client.factory';

export type RedisDistributedLease = {
  isHeld(): Promise<boolean>;
  release(): Promise<void>;
};

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;

@Injectable()
export class RedisDistributedLeaseService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisDistributedLeaseService.name);
  private readonly client: Redis | null;
  private readonly production: boolean;

  constructor(config: ConfigService, redisFactory: RedisClientFactory) {
    this.production = config.get<string>('NODE_ENV') === 'production';
    const url =
      config.get<string>('UPDATE_REDIS_URL') ||
      config.get<string>('REDIS_URL') ||
      config.get<string>('SESSION_STORE_REDIS_URL');
    this.client = url ? redisFactory.create(url, 'distributed-lease') : null;
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  async acquire(
    key: string,
    ttlMs: number,
  ): Promise<RedisDistributedLease | null> {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 5_000) {
      throw new RangeError('TTL de verrou distribue invalide');
    }
    if (!this.client) {
      if (this.production) {
        throw new Error(
          'Redis est requis en production pour les verrous distribues',
        );
      }
      return null;
    }
    const client = this.client;

    const token = randomUUID();
    const result = await client.set(key, token, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return null;

    let released = false;
    let lost = false;
    const renewTimer = setInterval(
      () => {
        if (released) return;
        void client
          .eval(RENEW_SCRIPT, 1, key, token, String(ttlMs))
          .then((renewed) => {
            if (renewed !== 1 && !released) {
              lost = true;
              this.logger.error(`Bail Redis perdu key=${key}`);
            }
          })
          .catch((error: unknown) => {
            if (!released) {
              this.logger.warn(
                `Renouvellement bail Redis impossible key=${key}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          });
      },
      Math.max(1_000, Math.floor(ttlMs / 3)),
    );
    renewTimer.unref?.();
    return {
      isHeld: async () => {
        if (released || lost) return false;
        const current = await client.get(key);
        if (current !== token) lost = true;
        return !lost;
      },
      release: async () => {
        if (released) return;
        released = true;
        clearInterval(renewTimer);
        await client.eval(RELEASE_SCRIPT, 1, key, token);
      },
    };
  }
}
