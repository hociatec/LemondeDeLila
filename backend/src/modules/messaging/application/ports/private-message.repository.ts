import type { PrivateMessageRecord } from '../contracts/private-message.model';

export const PRIVATE_MESSAGE_REPOSITORY = Symbol('PRIVATE_MESSAGE_REPOSITORY');

export type CreatePrivateMessageInput = {
  senderId: number;
  recipientId: number;
  messageId: string;
  message: string;
  subject: string | null;
};

export interface PrivateMessageRepository {
  create(input: CreatePrivateMessageInput): Promise<PrivateMessageRecord>;
  save(message: PrivateMessageRecord): Promise<PrivateMessageRecord>;
  findByMessageId(messageId: string): Promise<PrivateMessageRecord | null>;
  findConversation(
    currentUserId: number,
    otherUserId: number,
    limit: number,
  ): Promise<PrivateMessageRecord[]>;
  findInbox(userId: number, limit: number): Promise<PrivateMessageRecord[]>;
  findOutbox(userId: number, limit: number): Promise<PrivateMessageRecord[]>;
  findDeleted(userId: number, limit: number): Promise<PrivateMessageRecord[]>;
  remove(messageId: string): Promise<void>;
  countUnreadForRecipient(userId: number): Promise<number>;
}
