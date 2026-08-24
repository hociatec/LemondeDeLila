import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisClientFactory } from '../../common/redis/public-api';
import { PRIVATE_MESSAGE_REPOSITORY } from '../../messaging/application/ports/private-message.repository';
import { PrivateMessageTypeormRepository } from '../../messaging/infrastructure/persistence/typeorm/repositories/private-message-typeorm.repository';
import { NOTIFICATION_DISPATCHER } from '../application/ports/notification-dispatcher.port';
import { NotificationConfigurationError } from '../domain/errors/notification-domain.errors';
import { NOTIFICATION_FRIENDSHIP_REPOSITORY } from '../application/ports/notification-friendship.repository';
import { NOTIFICATION_INBOX_REPOSITORY } from '../application/ports/notification-inbox.repository';
import { AdminContactService } from '../application/services/admin-contact.service';
import { NotificationFriendPresenceService } from '../application/services/notification-friend-presence.service';
import {
  NotificationTransport,
  RedisNotificationTransport,
} from '../infrastructure/transport/notification-transport';
import { SocialRelationshipEntity } from '../../social/infrastructure/persistence/typeorm/entities/social-relationship.entity';
import {
  NOTIFICATION_SOCIAL_RELATIONSHIPS_TYPEORM_REPOSITORY,
  NotificationFriendshipTypeormRepository,
} from '../infrastructure/persistence/typeorm/repositories/notification-friendship-typeorm.repository';
import { NotificationInboxTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/notification-inbox-typeorm.repository';
import { NotificationDispatchService } from '../infrastructure/system/notification-dispatch.service';
import { UserBadgeCountsService } from '../application/services/user-badge-counts.service';

export const NOTIFICATION_CORE_PROVIDERS = [
  {
    provide: NOTIFICATION_SOCIAL_RELATIONSHIPS_TYPEORM_REPOSITORY,
    useExisting: getRepositoryToken(SocialRelationshipEntity),
  },
  PrivateMessageTypeormRepository,
  NotificationFriendshipTypeormRepository,
  NotificationInboxTypeormRepository,
  {
    provide: PRIVATE_MESSAGE_REPOSITORY,
    useExisting: PrivateMessageTypeormRepository,
  },
  {
    provide: NOTIFICATION_DISPATCHER,
    useExisting: NotificationDispatchService,
  },
  {
    provide: NOTIFICATION_FRIENDSHIP_REPOSITORY,
    useExisting: NotificationFriendshipTypeormRepository,
  },
  {
    provide: NOTIFICATION_INBOX_REPOSITORY,
    useExisting: NotificationInboxTypeormRepository,
  },
  {
    provide: NotificationTransport,
    inject: [ConfigService, RedisClientFactory],
    useFactory: async (
      config: ConfigService,
      redisFactory: RedisClientFactory,
    ) => {
      const redisUrl =
        config.get<string>('NOTIFICATION_REDIS_URL') ||
        config.get<string>('SESSION_STORE_REDIS_URL');
      if (!redisUrl) {
        throw new NotificationConfigurationError(
          'NOTIFICATION_REDIS_URL ou SESSION_STORE_REDIS_URL doit etre defini pour les notifications.',
        );
      }
      const transport = new RedisNotificationTransport(redisUrl, redisFactory);
      transport.connect().catch((error) => {
        const logger = new Logger('NotificationTransport');
        logger.warn(
          'Echec de la connexion Redis pour les notifications',
          error instanceof Error ? error.stack : String(error),
        );
      });
      return transport;
    },
  },
  NotificationDispatchService,
  UserBadgeCountsService,
  AdminContactService,
  NotificationFriendPresenceService,
];
