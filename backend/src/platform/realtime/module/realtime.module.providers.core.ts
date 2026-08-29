import { ConfigService } from '@nestjs/config';
import { SESSION_STORE } from '../../session/application/ports/session-state-store.port';
import { RedisSessionStore } from '../../session/infrastructure/persistence/redis-session-store';
import { RealtimeConfigurationError } from '../domain/errors/realtime-domain.errors';

export const REALTIME_CORE_PROVIDERS = [
  {
    provide: SESSION_STORE,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const redisUrl =
        config.get<string>('SESSION_STORE_REDIS_URL') ||
        config.get<string>('REDIS_URL');
      if (!redisUrl) {
        throw new RealtimeConfigurationError(
          'SESSION_STORE_REDIS_URL doit etre defini pour le module realtime.',
        );
      }
      return new RedisSessionStore(redisUrl);
    },
  },
];
