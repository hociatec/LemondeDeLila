import type { MessageId, UserId } from '../../../../shared/interfaces/public-api';

export type ChatBroadcastUser = {
  id: UserId;
  username: string;
};

export type ChatMessageRecordUser = {
  id: UserId;
  username: string;
  avatar: string | null;
  chatBannedUntil?: Date | null;
  chatBanReason?: string | null;
};

export type ChatMessageRecord = {
  id: number;
  messageId: MessageId;
  message: string;
  createdAt: Date;
  deletedAt: Date | null;
  user: ChatMessageRecordUser | null;
};

export type ChatNormalizedMessage = {
  id: MessageId;
  text: string;
  createdAt: string;
  user: {
    id: UserId | undefined;
    username: string | undefined;
    avatar: string | null;
  };
};
/** Explicitly named data contract at the application boundary. */

