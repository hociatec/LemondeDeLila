import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  serializeDate,
  serializeOptionalDate,
} from '../../../../../shared/utils/public-api';
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
    const requestedLimit =
      typeof input?.limit === 'number' ? input.limit : undefined;
    const configuredLimit = this.chatSettings.getChatHistoryLimit();
    const fallbackLimit =
      Number.isSafeInteger(configuredLimit) && configuredLimit > 0
        ? Math.min(500, configuredLimit)
        : 500;
    const limit =
      typeof requestedLimit === 'number' &&
      Number.isSafeInteger(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(500, requestedLimit)
        : fallbackLimit;
    const rows = await this.chat.adminListMessages(
      limit,
      input.includeDeleted ?? false,
    );

    return rows.slice(0, 500).map((message) => ({
      id: String(message.messageId ?? '').slice(0, 64),
      text: String(message.message ?? '').slice(0, 2_000),
      createdAt: serializeDate(message.createdAt),
      deletedAt: serializeOptionalDate(message.deletedAt),
      user: {
        id: message.user?.id ?? null,
        username:
          typeof message.user?.username === 'string'
            ? message.user.username.slice(0, 255)
            : null,
        avatar:
          typeof message.user?.avatar === 'string'
            ? message.user.avatar.slice(0, 2_048)
            : null,
        chatBannedUntil: serializeOptionalDate(message.user?.chatBannedUntil),
        chatBanReason:
          typeof message.user?.chatBanReason === 'string'
            ? message.user.chatBanReason.slice(0, 255)
            : null,
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
    if (
      (update.chatHistoryLimit !== undefined &&
        (!Number.isSafeInteger(update.chatHistoryLimit) ||
          update.chatHistoryLimit < 1 ||
          update.chatHistoryLimit > 2_000)) ||
      (update.editWindowSeconds !== undefined &&
        (!Number.isSafeInteger(update.editWindowSeconds) ||
          update.editWindowSeconds < 0 ||
          update.editWindowSeconds > 86_400))
    ) {
      throw new BadRequestException('Paramètres de chat invalides');
    }
    return this.chatSettings.updateSettings(update);
  }

  async deleteMessage(messageId: string) {
    if (
      typeof messageId !== 'string' ||
      !messageId.trim() ||
      messageId.length > 64
    ) {
      throw new BadRequestException('Identifiant de message invalide');
    }
    const ok = await this.chat.adminDeleteMessage(messageId);
    return { ok };
  }

  async clearMessages() {
    const deleted = await this.chat.adminClearAll();
    return { deleted };
  }
}
