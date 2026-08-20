import { ChatSettingsService } from '../services/chat-settings.service';
import { ChatService } from '../services/chat.service';
import { ChatValidator } from '../services/chat.validator';

export const CHAT_MODULE_EXPORTS = [
  ChatService,
  ChatSettingsService,
  ChatValidator,
];
