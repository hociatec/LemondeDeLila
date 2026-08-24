export const FRIEND_PRESENCE_NOTIFIER = Symbol('FRIEND_PRESENCE_NOTIFIER');

export type FriendPresenceNotifier = {
  notifyFriendConnected(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;
  notifyFriendDisconnected(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;
};
