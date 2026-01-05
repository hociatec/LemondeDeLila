import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationService } from './services/notification.service';
import {
  NotificationTransport,
  RedisNotificationTransport,
} from './services/notification-transport';
import { ClientUpdatesModule } from '../client-updates/client-updates.module';
import { RedisClientFactory } from '../common/redis/redis-client.factory';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialRelationship } from '../social/entities/social-relationship.entity';
import { User } from '../user/entities/user.entity';
import { AdminContactService } from './services/admin-contact.service';
import { NotificationInboxItem } from './entities/notification-inbox-item.entity';
import { NotificationInboxDbService } from './services/notification-inbox-db.service';
import { PrivateMessage } from '../messaging/entities/private-message.entity';
import { UserBadgeCountsService } from './services/user-badge-counts.service';

@Module({
  imports: [
    ConfigModule,
    ClientUpdatesModule,
    TypeOrmModule.forFeature([SocialRelationship, User, NotificationInboxItem, PrivateMessage]),
  ],
  providers: [
    {
      provide: NotificationTransport,
      inject: [ConfigService, RedisClientFactory],
      useFactory: async (config: ConfigService, redisFactory: RedisClientFactory) => {
        const redisUrl =
          config.get<string>('NOTIFICATION_REDIS_URL') ||
          config.get<string>('SESSION_STORE_REDIS_URL');
        if (!redisUrl) {
          throw new Error(
            'NOTIFICATION_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour les notifications.',
          );
        }
        const transport = new RedisNotificationTransport(redisUrl, redisFactory);
        await transport.connect();
        return transport;
      },
    },
    NotificationService,
    NotificationInboxDbService,
    UserBadgeCountsService,
    AdminContactService,
    NotificationGateway,
  ],
  exports: [
    NotificationService,
    AdminContactService,
    UserBadgeCountsService,
    NotificationInboxDbService,
  ],
})
export class NotificationModule {}
