import { RedisHealthIndicator } from '../infrastructure/checks/redis.health';

export const HEALTH_CORE_PROVIDERS = [RedisHealthIndicator];
