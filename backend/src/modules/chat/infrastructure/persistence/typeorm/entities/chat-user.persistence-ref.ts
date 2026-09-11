/** Chat-only user projection; credentials never cross the chat boundary. */
export type ChatUserPersistenceRef = {
  id: number;
  username: string;
  avatar?: string | null;
  chatBannedUntil?: Date | null;
  chatBanReason?: string | null;
};
