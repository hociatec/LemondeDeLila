export interface AdminChatSettings {
  chatHistoryLimit: number;
  editWindowSeconds: number;
}

export interface AdminChatMessageRecord {
  messageId: string;
  message: string;
  createdAt?: Date | null;
  deletedAt?: Date | null;
  user?: {
    id?: number | null;
    username?: string | null;
    avatar?: string | null;
    chatBannedUntil?: Date | null;
    chatBanReason?: string | null;
  } | null;
}

export interface AdminChatPort {
  adminListMessages(
    limit: number,
    includeDeleted: boolean,
  ): Promise<AdminChatMessageRecord[]>;
  adminDeleteMessage(messageId: string): Promise<boolean>;
  adminClearAll(): Promise<number>;
}

export interface AdminChatSettingsPort {
  getSettings(): AdminChatSettings;
  getChatHistoryLimit(): number;
  updateSettings(update: {
    chatHistoryLimit?: number;
    editWindowSeconds?: number;
  }): Promise<AdminChatSettings>;
}

export const ADMIN_CHAT_PORT = Symbol('ADMIN_CHAT_PORT');
export const ADMIN_CHAT_SETTINGS_PORT = Symbol('ADMIN_CHAT_SETTINGS_PORT');
