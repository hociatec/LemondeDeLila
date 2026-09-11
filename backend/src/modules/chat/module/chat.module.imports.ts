import { BusinessClockModule } from '../../../platform/time/public-api';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from '../infrastructure/persistence/typeorm/entities/chat-message.entity';
import { ChatSettingsEntity } from '../infrastructure/persistence/typeorm/entities/chat-settings.entity';

export const CHAT_MODULE_IMPORTS = [
  BusinessClockModule,
  TypeOrmModule.forFeature([ChatMessage, ChatSettingsEntity]),
];
