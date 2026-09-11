export const ACCEPTED_FRIENDS_READER = Symbol('ACCEPTED_FRIENDS_READER');

export interface AcceptedFriendsReader {
  listAcceptedFriendIds(userId: number): Promise<number[]>;
}
