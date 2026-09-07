import { RedisClientFactory } from '../infrastructure/redis-client.factory';
import { RedisRateLimitStorage } from '../infrastructure/redis-rate-limit.storage';

export const REDIS_CORE_PROVIDERS = [RedisClientFactory, RedisRateLimitStorage];
