import { ChatMessageCacheService } from '../application/services/chat-message-cache.service';
import { ChatMessagePresenterService } from '../application/services/chat-message-presenter.service';
import { ChatSettingsPolicyService } from '../application/services/chat-settings-policy.service';
import { CHAT_MESSAGE_REPOSITORY } from '../application/ports/chat-message.repository';
import { CHAT_SETTINGS_REPOSITORY } from '../application/ports/chat-settings.repository';
import { ChatValidator } from '../application/use-cases/chat/chat.validator';
import { ChatMessageTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/chat-message-typeorm.repository';
import { ChatSettingsTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/chat-settings-typeorm.repository';

export const CHAT_CORE_PROVIDERS = [
  ChatValidator,
  ChatMessageCacheService,
  ChatMessagePresenterService,
  ChatSettingsPolicyService,
  ChatMessageTypeormRepository,
  ChatSettingsTypeormRepository,
  {
    provide: CHAT_MESSAGE_REPOSITORY,
    useExisting: ChatMessageTypeormRepository,
  },
  {
    provide: CHAT_SETTINGS_REPOSITORY,
    useExisting: ChatSettingsTypeormRepository,
  },
];
