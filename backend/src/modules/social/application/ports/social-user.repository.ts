import type {
  SocialSearchUserSummary,
  SocialUserSummary,
} from '../contracts/social-user.model';

export const SOCIAL_USER_READER = Symbol('SOCIAL_USER_READER');

export interface SocialUserReader {
  findById(id: number): Promise<SocialUserSummary | null>;
  searchUsers(
    query: string,
    excludeUserId: number,
    limit: number,
  ): Promise<SocialSearchUserSummary[]>;
}
