export const MESSAGING_NOTIFICATION_DISPATCHER = Symbol(
  'MESSAGING_NOTIFICATION_DISPATCHER',
);

export interface MessagingNotificationDispatcher {
  notifyUser(
    userId: number,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}

export const MESSAGING_BADGE_COUNTS_NOTIFIER = Symbol(
  'MESSAGING_BADGE_COUNTS_NOTIFIER',
);

export interface MessagingBadgeCountsNotifier {
  notifyCounts(userId: number): Promise<void>;
}
