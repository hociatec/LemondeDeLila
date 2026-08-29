export const USER_BADGE_COUNTS_NOTIFIER = Symbol('USER_BADGE_COUNTS_NOTIFIER');

export interface UserBadgeCountsNotifier {
  notifyCounts(userId: number): Promise<void>;
  notifyCountsBestEffort(userId: number): Promise<void>;
}
