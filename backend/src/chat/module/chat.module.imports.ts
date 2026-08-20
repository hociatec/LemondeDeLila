import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from '../entities/chat-message.entity';
import { ChatSettingsEntity } from '../entities/chat-settings.entity';

export const CHAT_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([ChatMessage, ChatSettingsEntity]),
];
