import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ApplicationShutdownService } from '../../lifecycle/public-api';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { RedisClientFactory } from './redis-client.factory';

const INCREMENT_SCRIPT = `
local block_ttl = redis.call('PTTL', KEYS[2])
if block_ttl > 0 then
  local hit_ttl = redis.call('PTTL', KEYS[1])
  if hit_ttl < 0 then hit_ttl = tonumber(ARGV[1]) end
  return {tonumber(ARGV[2]) + 1, hit_ttl, 1, block_ttl}
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local hit_ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  local duration = tonumber(ARGV[3])
  if duration <= 0 then duration = tonumber(ARGV[1]) end
  redis.call('PSETEX', KEYS[2], duration, '1')
  return {hits, hit_ttl, 1, duration}
end
return {hits, hit_ttl, 0, 0}
`;

@Injectable()
export class RedisRateLimitStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly client: Redis;

  constructor(
    config: ConfigService,
    redisFactory: RedisClientFactory,
    @Inject(ApplicationShutdownService)
    private readonly shutdown = new ApplicationShutdownService(),
  ) {
    const url =
      config.get<string>('RATE_LIMIT_REDIS_URL') ??
      config.get<string>('SESSION_STORE_REDIS_URL');
    if (!url) {
      throw new Error(
        'RATE_LIMIT_REDIS_URL ou SESSION_STORE_REDIS_URL est requis',
      );
    }
    this.client = redisFactory.create(url, 'http-rate-limit', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    // HTTP guards run before interceptors, including when a client aborts.
    return this.shutdown.run(
      () =>
        this.incrementInRedis(key, ttl, limit, blockDuration, throttlerName),
      true,
    );
  }

  private async incrementInRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > 256 ||
      typeof throttlerName !== 'string' ||
      throttlerName.length === 0 ||
      throttlerName.length > 128 ||
      !Number.isSafeInteger(ttl) ||
      ttl <= 0 ||
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      !Number.isSafeInteger(blockDuration) ||
      blockDuration < 0 ||
      blockDuration > 86_400_000
    ) {
      throw new Error('Invalid Redis rate-limit options');
    }
    const namespace = `lila:throttle:${throttlerName}:${key}`;
    const raw: unknown = await this.client.eval(
      INCREMENT_SCRIPT,
      2,
      `${namespace}:hits`,
      `${namespace}:block`,
      String(ttl),
      String(limit),
      String(blockDuration),
    );
    if (
      !Array.isArray(raw) ||
      raw.length !== 4 ||
      !raw.every(
        (value: unknown) =>
          typeof value === 'number' && Number.isSafeInteger(value),
      ) ||
      ![0, 1].includes(Number(raw[2])) ||
      Number(raw[0]) < 0
    ) {
      throw new Error('Invalid Redis rate-limit response');
    }
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] =
      raw.map(Number);
    return {
      totalHits: totalHits ?? 0,
      timeToExpire: millisecondsToSeconds(timeToExpire),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: millisecondsToSeconds(timeToBlockExpire),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') await this.client.quit();
  }
}

function millisecondsToSeconds(value: number | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.ceil(value / 1000)
    : 0;
}
