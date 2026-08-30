import type { MessageUser } from '../contracts/message-user.model';

export const MESSAGING_USER_READER = Symbol('MESSAGING_USER_READER');

export interface MessagingUserReader {
  findById(id: number): Promise<MessageUser | null>;
  findByUsername(username: string): Promise<MessageUser | null>;
}
