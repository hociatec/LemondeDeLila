export interface SocialRelationshipNotifier {
  notifyFriendRequested(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;

  notifyFriendAccepted(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;

  notifyFriendRejected(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;
}

export const SOCIAL_RELATIONSHIP_NOTIFIER = Symbol(
  'SOCIAL_RELATIONSHIP_NOTIFIER',
);
