import { Global, Module } from '@nestjs/common';
import { RedisClientFactory } from '../infrastructure/redis-client.factory';
import { REDIS_CORE_PROVIDERS } from './redis.module.providers.core';

@Global()
@Module({
  providers: REDIS_CORE_PROVIDERS,
  exports: [RedisClientFactory],
})
export class RedisModule {}
