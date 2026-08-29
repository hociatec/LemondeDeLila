import { ChatSettingsService } from '../application/use-cases/chat/chat-settings.service';
import { ChatService } from '../application/use-cases/chat/chat.service';
import { ChatValidator } from '../application/use-cases/chat/chat.validator';

export const CHAT_MODULE_EXPORTS = [
  ChatService,
  ChatSettingsService,
  ChatValidator,
];
