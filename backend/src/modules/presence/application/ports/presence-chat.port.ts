import type { PresenceChatHistory } from '../models/presence-chat-history.model';

export const PRESENCE_CHAT_PORT = Symbol('PRESENCE_CHAT_PORT');

export interface PresenceChatPort {
  getHistory(): Promise<PresenceChatHistory>;
  recordMessage(input: {
    userId: number;
    username: string;
    text: string;
  }): Promise<Record<string, unknown>>;
  editOwnMessage(
    userId: number,
    messageId: string,
    text: string,
  ): Promise<Record<string, unknown>>;
  deleteOwnMessage(userId: number, messageId: string): Promise<boolean>;
}
