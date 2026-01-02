import { Global, Module } from '@nestjs/common';
import { RedisClientFactory } from './redis-client.factory';

@Global()
@Module({
  providers: [RedisClientFactory],
  exports: [RedisClientFactory],
})
export class RedisModule {}

