export const UNREAD_PRIVATE_MESSAGES_READER = Symbol(
  'UNREAD_PRIVATE_MESSAGES_READER',
);

export interface UnreadPrivateMessagesReader {
  countUnreadForRecipient(userId: number): Promise<number>;
}
