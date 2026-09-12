export const NOTIFICATION_FRIENDS_READER = Symbol(
  'NOTIFICATION_FRIENDS_READER',
);

export interface NotificationFriendsReader {
  listAcceptedFriendIds(userId: number): Promise<number[]>;
}
