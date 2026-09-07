import { BullmqHealthIndicator } from '../infrastructure/checks/bullmq.health';
import { RedisHealthIndicator } from '../infrastructure/checks/redis.health';
import { RuntimeHealthIndicator } from '../infrastructure/checks/runtime.health';

export const HEALTH_CORE_PROVIDERS = [
  RedisHealthIndicator,
  BullmqHealthIndicator,
  RuntimeHealthIndicator,
];
