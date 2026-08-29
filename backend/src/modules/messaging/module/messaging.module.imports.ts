import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../../notification/public-api';
import { User } from '../../user/public-api';
import { PrivateMessageEntity } from '../infrastructure/persistence/typeorm/entities/private-message.entity';

export const MESSAGING_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([PrivateMessageEntity, User]),
  NotificationModule,
];
