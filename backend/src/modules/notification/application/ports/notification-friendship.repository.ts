export const NOTIFICATION_FRIENDSHIP_REPOSITORY = Symbol(
  'NOTIFICATION_FRIENDSHIP_REPOSITORY',
);

export interface NotificationFriendshipRepository {
  listAcceptedFriendIds(userId: number): Promise<number[]>;
}
