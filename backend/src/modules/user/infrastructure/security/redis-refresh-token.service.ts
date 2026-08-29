import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { bestEffort } from '../../../../shared/utils/public-api';
import type {
  RefreshTokenRotation,
  RefreshTokenServicePort,
} from '../../application/ports/refresh-token.port';

@Injectable()
export class RedisRefreshTokenService
  implements RefreshTokenServicePort, OnModuleDestroy
{
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private readonly prefix = 'auth:refresh:';

  constructor(config: ConfigService, redisFactory: RedisClientFactory) {
    const redisUrl =
      config.get<string>('SESSION_STORE_REDIS_URL') ||
      config.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error(
        'SESSION_STORE_REDIS_URL doit etre defini pour les refresh tokens.',
      );
    }

    this.ttlSeconds = Math.max(
      3600,
      Number(config.get<number>('REFRESH_TOKEN_TTL_SECONDS', 2_592_000)),
    );
    this.redis = redisFactory.create(redisUrl, 'auth-refresh', {
      lazyConnect: true,
    });
  }

  async issue(userId: number): Promise<string> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.redis.set(
      this.key(refreshToken),
      JSON.stringify({ userId }),
      'EX',
      this.ttlSeconds,
    );
    return refreshToken;
  }

  async rotate(refreshToken: string): Promise<RefreshTokenRotation | null> {
    if (!refreshToken) return null;

    const consumeScript = `
      local value = redis.call('GET', KEYS[1])
      if value then redis.call('DEL', KEYS[1]) end
      return value
    `;
    const raw: unknown = await this.redis.eval(
      consumeScript,
      1,
      this.key(refreshToken),
    );
    if (typeof raw !== 'string' || !raw) return null;

    let userId: number;
    try {
      const decoded: unknown = JSON.parse(raw);
      if (!isRecord(decoded)) return null;
      userId = Number(decoded.userId);
    } catch {
      return null;
    }
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;

    return {
      userId,
      refreshToken: await this.issue(userId),
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    await this.redis.del(this.key(refreshToken));
  }

  async onModuleDestroy(): Promise<void> {
    await bestEffort(this.redis.quit(), 'fermeture Redis refresh tokens');
  }

  private key(refreshToken: string): string {
    const digest = createHash('sha256').update(refreshToken).digest('hex');
    return this.prefix + digest;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
