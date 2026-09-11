import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { bestEffort } from '../../../../platform/observability/public-api';
import { operationalSettings } from '../../../../platform/config/public-api';
import type {
  RefreshTokenRotation,
  RefreshTokenServicePort,
} from '../../application/ports/refresh-token.port';

@Injectable()
export class RedisRefreshTokenService
  implements RefreshTokenServicePort, OnModuleDestroy
{
  private static readonly MAX_TOKEN_INPUT_LENGTH = 1024;
  private static readonly MAX_RECORD_BYTES = 4096;
  private static readonly MAX_TOKENS_PER_USER = 256;
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private readonly prefix = 'auth:refresh:';
  private readonly userIndexPrefix = 'auth:refresh:user:';

  constructor(config: ConfigService, redisFactory: RedisClientFactory) {
    const redisUrl =
      config.get<string>('SESSION_STORE_REDIS_URL') ||
      config.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error(
        'SESSION_STORE_REDIS_URL doit etre defini pour les refresh tokens.',
      );
    }

    const configuredTtl = config.get<number>('REFRESH_TOKEN_TTL_SECONDS');
    this.ttlSeconds =
      typeof configuredTtl === 'number' &&
      Number.isSafeInteger(configuredTtl) &&
      configuredTtl > 0
        ? configuredTtl
        : operationalSettings.refreshTokenTtlSeconds;
    this.redis = redisFactory.create(redisUrl, 'auth-refresh', {
      lazyConnect: true,
    });
  }

  async issue(userId: number): Promise<string> {
    if (!Number.isSafeInteger(userId) || userId <= 0)
      throw new RangeError('Identifiant utilisateur invalide');
    const refreshToken = randomBytes(48).toString('base64url');
    const addToUserIndexScript = `
      local count = redis.call('SCARD', KEYS[1])
      local excess = count - tonumber(ARGV[2]) + 1
      if excess > 0 then
        local evicted = redis.call('SPOP', KEYS[1], excess)
        for _, tokenKey in ipairs(evicted) do redis.call('DEL', tokenKey) end
      end
      redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[3])
      redis.call('SADD', KEYS[1], KEYS[2])
      redis.call('EXPIRE', KEYS[1], ARGV[3])
      return 1
    `;
    await this.redis.eval(
      addToUserIndexScript,
      2,
      this.userIndex(userId),
      this.key(refreshToken),
      JSON.stringify({ userId }),
      RedisRefreshTokenService.MAX_TOKENS_PER_USER,
      this.ttlSeconds,
    );
    return refreshToken;
  }

  async rotate(refreshToken: string): Promise<RefreshTokenRotation | null> {
    if (
      typeof refreshToken !== 'string' ||
      !refreshToken ||
      refreshToken.length > RedisRefreshTokenService.MAX_TOKEN_INPUT_LENGTH
    )
      return null;

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
    if (
      Buffer.byteLength(raw, 'utf8') > RedisRefreshTokenService.MAX_RECORD_BYTES
    )
      return null;

    let userId: number;
    try {
      const decoded: unknown = JSON.parse(raw);
      if (!isRecord(decoded)) return null;
      if (typeof decoded.userId !== 'number') return null;
      userId = decoded.userId;
    } catch {
      return null;
    }
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;

    await this.redis.srem?.(this.userIndex(userId), this.key(refreshToken));

    return {
      userId,
      refreshToken: await this.issue(userId),
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    if (
      typeof refreshToken !== 'string' ||
      !refreshToken ||
      refreshToken.length > RedisRefreshTokenService.MAX_TOKEN_INPUT_LENGTH
    )
      return;
    const tokenKey = this.key(refreshToken);
    const raw = await this.redis.get?.(tokenKey);
    await this.redis.del(tokenKey);
    if (typeof raw !== 'string') return;
    if (
      Buffer.byteLength(raw, 'utf8') > RedisRefreshTokenService.MAX_RECORD_BYTES
    )
      return;
    try {
      const decoded: unknown = JSON.parse(raw);
      if (
        isRecord(decoded) &&
        typeof decoded.userId === 'number' &&
        Number.isSafeInteger(decoded.userId) &&
        decoded.userId > 0
      ) {
        await this.redis.srem?.(this.userIndex(decoded.userId), tokenKey);
      }
    } catch {
      // Invalid token records are already removed.
    }
  }

  async revokeAllForUser(userId: number): Promise<void> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new RangeError('Identifiant utilisateur invalide');
    }
    const indexKey = this.userIndex(userId);
    const revokeScript = `
      local tokenKeys = redis.call('SMEMBERS', KEYS[1])
      for _, tokenKey in ipairs(tokenKeys) do
        redis.call('DEL', tokenKey)
      end
      redis.call('DEL', KEYS[1])
      return #tokenKeys
    `;
    await this.redis.eval(revokeScript, 1, indexKey);
  }

  async onModuleDestroy(): Promise<void> {
    await bestEffort(this.redis.quit(), 'fermeture Redis refresh tokens');
  }

  private key(refreshToken: string): string {
    const digest = createHash('sha256').update(refreshToken).digest('hex');
    return this.prefix + digest;
  }

  private userIndex(userId: number): string {
    return this.userIndexPrefix + userId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
