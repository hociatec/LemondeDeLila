import { ConfigModule } from '@nestjs/config';
import { BusinessClockModule } from '../../../platform/time/public-api';
import { ChatModule } from '../../chat/composition-api';
import { UpdateModule } from '../../update/composition-api';

export const PRESENCE_MODULE_IMPORTS = [
  ConfigModule,
  BusinessClockModule,
  ChatModule,
  UpdateModule,
];
