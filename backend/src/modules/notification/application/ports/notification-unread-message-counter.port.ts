export const NOTIFICATION_UNREAD_MESSAGE_COUNTER = Symbol(
  'NOTIFICATION_UNREAD_MESSAGE_COUNTER',
);

export interface NotificationUnreadMessageCounter {
  countUnreadForRecipient(userId: number): Promise<number>;
}
