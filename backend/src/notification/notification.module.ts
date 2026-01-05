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
import { UserInboxService } from './services/user-inbox.service';
import { AdminContactService } from './services/admin-contact.service';

@Module({
  imports: [
    ConfigModule,
    ClientUpdatesModule,
    TypeOrmModule.forFeature([SocialRelationship, User]),
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
    UserInboxService,
    AdminContactService,
    NotificationGateway,
  ],
  exports: [NotificationService, AdminContactService],
})
export class NotificationModule {}
