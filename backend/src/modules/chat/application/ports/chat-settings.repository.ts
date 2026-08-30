import { ChatSettings } from '../contracts/chat-settings.record';

export const CHAT_SETTINGS_REPOSITORY = Symbol('CHAT_SETTINGS_REPOSITORY');

export interface ChatSettingsRepository {
  find(): Promise<ChatSettings | null>;
  createDefaults(settings: ChatSettings): Promise<void>;
  save(settings: ChatSettings): Promise<void>;
}
