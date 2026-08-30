export type PresenceUserChatBan = {
  id: number;
  chatBannedUntil: Date | null;
  chatBanReason: string | null;
};
/** Explicitly named data contract at the application boundary. */
