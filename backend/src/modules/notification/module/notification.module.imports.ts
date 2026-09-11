import { ConfigModule } from '@nestjs/config';
import { BusinessClockModule } from '../../../platform/time/public-api';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpdateModule } from '../../update/composition-api';
import { UserModule } from '../../user/composition-api';
import { NotificationInboxItemEntity } from '../infrastructure/persistence/typeorm/entities/notification-inbox-item.entity';

export const NOTIFICATION_MODULE_IMPORTS = [
  BusinessClockModule,
  ConfigModule,
  UpdateModule,
  UserModule,
  TypeOrmModule.forFeature([NotificationInboxItemEntity]),
];
