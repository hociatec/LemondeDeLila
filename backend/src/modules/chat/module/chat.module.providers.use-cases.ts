import { AdminClearChatMessagesService } from '../application/use-cases/chat/admin-clear-chat-messages.service';
import { AdminDeleteChatMessageService } from '../application/use-cases/chat/admin-delete-chat-message.service';
import { AdminListChatMessagesService } from '../application/use-cases/chat/admin-list-chat-messages.service';
import { ChatSettingsService } from '../application/use-cases/chat/chat-settings.service';
import { ChatService } from '../application/use-cases/chat/chat.service';
import { DeleteOwnChatMessageService } from '../application/use-cases/chat/delete-own-chat-message.service';
import { EditOwnChatMessageService } from '../application/use-cases/chat/edit-own-chat-message.service';
import { GetChatSettingsService } from '../application/use-cases/chat/get-chat-settings.service';
import { ListRecentChatMessagesService } from '../application/use-cases/chat/list-recent-chat-messages.service';
import { ListRecentNormalizedChatMessagesService } from '../application/use-cases/chat/list-recent-normalized-chat-messages.service';
import { RecordChatMessageService } from '../application/use-cases/chat/record-chat-message.service';
import { UpdateChatSettingsService } from '../application/use-cases/chat/update-chat-settings.service';

export const CHAT_USE_CASE_PROVIDERS = [
  RecordChatMessageService,
  EditOwnChatMessageService,
  DeleteOwnChatMessageService,
  ListRecentChatMessagesService,
  ListRecentNormalizedChatMessagesService,
  AdminListChatMessagesService,
  AdminDeleteChatMessageService,
  AdminClearChatMessagesService,
  GetChatSettingsService,
  UpdateChatSettingsService,
  ChatSettingsService,
  ChatService,
];
