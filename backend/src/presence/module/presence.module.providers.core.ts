import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisClientFactory } from '../../common/redis/infrastructure/redis-client.factory';
import { PresenceConfigurationError } from '../domain/errors/presence-domain.errors';
import { PRESENCE_CHAT_PORT } from '../application/ports/presence-chat.port';
import {
  PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
} from '../application/ports/presence-room-participant.repository';
import { PRESENCE_USER_REPOSITORY } from '../application/ports/presence-user.repository';
import {
  PresenceTransport,
} from '../application/ports/presence-transport.port';
import {
  RedisPresenceTransport,
} from '../infrastructure/transport/presence-transport';
import { PresenceChatService } from '../application/services/presence-chat.service';
import { PresenceService } from '../application/services/presence.service';
import { RoomParticipant } from '../../room/infrastructure/persistence/typeorm/entities/room-participant.entity';
import {
  PRESENCE_ROOM_PARTICIPANTS_TYPEORM_REPOSITORY,
  PresenceRoomParticipantTypeormRepository,
} from '../infrastructure/persistence/typeorm/repositories/presence-room-participant-typeorm.repository';
import { PresenceUserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/presence-user-typeorm.repository';
import { PresenceChatAdapter } from '../infrastructure/system/presence-chat.adapter';

export const PRESENCE_CORE_PROVIDERS = [
  {
    provide: PRESENCE_ROOM_PARTICIPANTS_TYPEORM_REPOSITORY,
    useExisting: getRepositoryToken(RoomParticipant),
  },
  {
    provide: PresenceTransport,
    inject: [ConfigService, RedisClientFactory],
    useFactory: async (
      config: ConfigService,
      redisFactory: RedisClientFactory,
    ) => {
      const redisUrl =
        config.get<string>('PRESENCE_REDIS_URL') ||
        config.get<string>('SESSION_STORE_REDIS_URL');
      if (!redisUrl) {
        throw new PresenceConfigurationError(
          'PRESENCE_REDIS_URL ou SESSION_STORE_REDIS_URL doit etre defini pour la presence.',
        );
      }
      const transport = new RedisPresenceTransport(redisUrl, redisFactory);
      transport.connect().catch((error) => {
        const logger = new Logger('PresenceTransport');
        logger.warn(
          'Echec de la connexion Redis pour les presences',
          error instanceof Error ? error.stack : String(error),
        );
      });
      return transport;
    },
  },
  PresenceChatAdapter,
  PresenceRoomParticipantTypeormRepository,
  PresenceUserTypeormRepository,
  {
    provide: PRESENCE_CHAT_PORT,
    useExisting: PresenceChatAdapter,
  },
  {
    provide: PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
    useExisting: PresenceRoomParticipantTypeormRepository,
  },
  {
    provide: PRESENCE_USER_REPOSITORY,
    useExisting: PresenceUserTypeormRepository,
  },
  PresenceService,
  PresenceChatService,
];
