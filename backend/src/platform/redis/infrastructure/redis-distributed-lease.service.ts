import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { RedisClientFactory } from './redis-client.factory';
import { prometheusMetrics } from '../../observability/public-api';

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
  private readonly active = new Set<() => void>();
  private destroyed = false;

  constructor(config: ConfigService, redisFactory: RedisClientFactory) {
    this.production = config.get<string>('NODE_ENV') === 'production';
    const url =
      config.get<string>('UPDATE_REDIS_URL') ||
      config.get<string>('REDIS_URL') ||
      config.get<string>('SESSION_STORE_REDIS_URL');
    this.client = url ? redisFactory.create(url, 'distributed-lease') : null;
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const lose of this.active) lose();
    this.client?.disconnect();
  }

  async acquire(
    key: string,
    ttlMs: number,
  ): Promise<RedisDistributedLease | null> {
    if (this.destroyed) throw new Error('Service de baux arrete');
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 5_000) {
      throw new RangeError('TTL de verrou distribue invalide');
    }
    if (!this.client) {
      if (this.production) {
        throw new Error(
          'Redis est requis en production pour les verrous distribues',
        );
      }
      // null means contention only, never a silently disabled distributed lock.
      throw new Error('Redis non configure pour les verrous distribues');
    }
    const client = this.client;

    const token = randomUUID();
    const validUntil = performance.now() + ttlMs;
    const result = await client.set(key, token, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return null;

    return this.createLease(client, key, token, ttlMs, validUntil);
  }

  private createLease(
    client: Redis,
    key: string,
    token: string,
    ttlMs: number,
    validUntil: number,
  ): RedisDistributedLease {
    let released = false;
    let lost = false;
    let renewing = false;
    const lose = () => {
      if (!lost && !released && !this.destroyed)
        prometheusMetrics.leases.lose();
      lost = true;
      clearInterval(renewTimer);
      this.active.delete(lose);
    };
    const expired = () => {
      if (performance.now() >= validUntil) lose();
      return released || lost;
    };
    const renewTimer = setInterval(
      () => {
        if (expired() || renewing) return;
        renewing = true;
        const nextValidUntil = performance.now() + ttlMs;
        void client
          .eval(RENEW_SCRIPT, 1, key, token, String(ttlMs))
          .then((renewed) => {
            if (expired()) return;
            if (renewed !== 1) {
              lose();
              this.logger.error('Bail Redis perdu');
            } else {
              validUntil = nextValidUntil;
            }
          })
          .catch(() => {
            if (!released) {
              lose();
              // Driver errors may contain credentials. The lease is unusable
              // after any uncertain renewal, even if Redis later recovers.
              this.logger.warn('Renouvellement bail Redis impossible');
            }
          })
          .finally(() => {
            renewing = false;
          });
      },
      Math.max(1_000, Math.floor(ttlMs / 3)),
    );
    renewTimer.unref?.();
    this.active.add(lose);
    if (this.destroyed) lose();
    return {
      isHeld: async () => {
        if (expired()) return false;
        try {
          const current = await client.get(key);
          if (current !== token) lose();
          return !expired();
        } catch {
          lose();
          return false;
        }
      },
      release: async () => {
        if (released) return;
        released = true;
        lose();
        await client.eval(RELEASE_SCRIPT, 1, key, token);
      },
    };
  }
}
