import { ChatMessageRecord } from '../models/chat-message.record';

export const CHAT_MESSAGE_REPOSITORY = Symbol('CHAT_MESSAGE_REPOSITORY');

export type CreateChatMessageInput = {
  userId: number;
  messageId: string;
  message: string;
  createdAt: Date;
};

export interface ChatMessageRepository {
  create(input: CreateChatMessageInput): Promise<ChatMessageRecord>;
  listRecent(limit: number, since?: Date): Promise<ChatMessageRecord[]>;
  listForAdmin(
    limit: number,
    includeDeleted: boolean,
  ): Promise<ChatMessageRecord[]>;
  findByMessageId(messageId: string): Promise<ChatMessageRecord | null>;
  updateMessage(id: number, message: string): Promise<ChatMessageRecord>;
  deleteById(id: number): Promise<boolean>;
  deleteByMessageId(messageId: string): Promise<boolean>;
  deleteAll(): Promise<number>;
}
