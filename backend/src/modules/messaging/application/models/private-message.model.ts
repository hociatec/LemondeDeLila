import type { MessageUser } from './message-user.model';

export type PrivateMessageRecord = {
  id: number;
  messageId: string;
  sender: MessageUser;
  recipient: MessageUser;
  message: string;
  subject: string | null;
  createdAt: Date;
  deletedBySenderAt: Date | null;
  deletedByRecipientAt: Date | null;
  readByRecipientAt: Date | null;
};
