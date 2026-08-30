export type ChatBroadcastUser = {
  id: number;
  username: string;
};

export type ChatMessageRecordUser = {
  id: number;
  username: string;
  avatar: string | null;
  chatBannedUntil?: Date | null;
  chatBanReason?: string | null;
};

export type ChatMessageRecord = {
  id: number;
  messageId: string;
  message: string;
  createdAt: Date;
  deletedAt: Date | null;
  user: ChatMessageRecordUser | null;
};

export type ChatNormalizedMessage = {
  id: string;
  text: string;
  createdAt: string;
  user: {
    id: number | undefined;
    username: string | undefined;
    avatar: string | null;
  };
};
/** Explicitly named data contract at the application boundary. */
