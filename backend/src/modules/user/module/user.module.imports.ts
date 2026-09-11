import { BusinessClockModule } from '../../../platform/time/public-api';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../infrastructure/persistence/typeorm/entities/user.entity';

export const USER_MODULE_IMPORTS = [
  BusinessClockModule,
  TypeOrmModule.forFeature([User]),
];
