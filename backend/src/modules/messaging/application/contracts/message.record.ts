import type { MessageUser } from './message-user.model';

export type MessageDto = {
  id: string;
  sender: MessageUser;
  recipient: MessageUser;
  text: string;
  subject: string | null;
  createdAt: string;
  direction: 'sent' | 'received';
  deletedAt: string | null;
  boxType: 'inbox' | 'outbox' | 'deleted';
};
/** Explicitly named data contract at the application boundary. */
