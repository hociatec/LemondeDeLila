import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RealtimeApiGateway } from './gateways/realtime-api.gateway';
import { SESSION_STORE } from '../common/session/session-store.interface';
import { InMemorySessionStore } from '../common/session/in-memory-session-store';
import { RedisSessionStore } from '../common/session/redis-session-store';

@Module({
  providers: [
    {
      provide: SESSION_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>('SESSION_STORE_REDIS_URL') ||
          config.get<string>('REDIS_URL');
        if (redisUrl) {
          return new RedisSessionStore(redisUrl);
        }
        return new InMemorySessionStore();
      },
    },
    RealtimeApiGateway,
  ],
})
export class RealtimeModule {}
