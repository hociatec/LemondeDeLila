import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_CHAT_PORT,
  ADMIN_CHAT_SETTINGS_PORT,
  type AdminChatPort,
  type AdminChatSettingsPort,
} from '../../ports/admin-chat.port';

@Injectable()
export class AdminChatService {
  constructor(
    @Inject(ADMIN_CHAT_PORT)
    private readonly chat: AdminChatPort,
    @Inject(ADMIN_CHAT_SETTINGS_PORT)
    private readonly chatSettings: AdminChatSettingsPort,
  ) {}

  async listMessages(input: { limit?: number; includeDeleted?: boolean }) {
    const rows = await this.chat.adminListMessages(
      input.limit ?? this.chatSettings.getChatHistoryLimit(),
      input.includeDeleted ?? false,
    );

    return rows.map((message) => ({
      id: message.messageId,
      text: message.message,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : new Date().toISOString(),
      deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
      user: {
        id: message.user?.id ?? null,
        username: message.user?.username ?? null,
        avatar: message.user?.avatar ?? null,
        chatBannedUntil: message.user?.chatBannedUntil
          ? message.user.chatBannedUntil instanceof Date
            ? message.user.chatBannedUntil.toISOString()
            : null
          : null,
        chatBanReason: message.user?.chatBanReason ?? null,
      },
    }));
  }

  getSettings() {
    return this.chatSettings.getSettings();
  }

  updateSettings(update: {
    chatHistoryLimit?: number;
    editWindowSeconds?: number;
  }) {
    return this.chatSettings.updateSettings(update);
  }

  async deleteMessage(messageId: string) {
    const ok = await this.chat.adminDeleteMessage(messageId);
    return { ok };
  }

  async clearMessages() {
    const deleted = await this.chat.adminClearAll();
    return { deleted };
  }
}
