import type { PresenceUserChatBan } from '../models/presence-user-chat-ban.model';

export const PRESENCE_USER_REPOSITORY = Symbol('PRESENCE_USER_REPOSITORY');

export interface PresenceUserRepository {
  findChatBanByUserId(userId: number): Promise<PresenceUserChatBan | null>;
}
