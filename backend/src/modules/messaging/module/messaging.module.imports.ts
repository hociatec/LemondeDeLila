import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessClockModule } from '../../../platform/time/public-api';
import { NotificationModule } from '../../notification/composition-api';
import { PrivateMessageEntity } from '../infrastructure/persistence/typeorm/entities/private-message.entity';

export const MESSAGING_MODULE_IMPORTS = [
  BusinessClockModule,
  TypeOrmModule.forFeature([PrivateMessageEntity]),
  NotificationModule,
];
