import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpdateModule } from '../../update/public-api';
import { PrivateMessageEntity } from '../../messaging/infrastructure/persistence/typeorm/entities/private-message.entity';
import { SocialRelationshipEntity } from '../../social/infrastructure/persistence/typeorm/entities/social-relationship.entity';
import { UserModule } from '../../user/public-api';
import { NotificationInboxItemEntity } from '../infrastructure/persistence/typeorm/entities/notification-inbox-item.entity';

export const NOTIFICATION_MODULE_IMPORTS = [
  ConfigModule,
  UpdateModule,
  UserModule,
  TypeOrmModule.forFeature([
    SocialRelationshipEntity,
    NotificationInboxItemEntity,
    PrivateMessageEntity,
  ]),
];
