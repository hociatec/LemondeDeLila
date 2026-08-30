import type {
  SocialProfileRecord,
  SocialProfileVisibility,
} from '../contracts/social-profile.model';
import type { SocialUserSummary } from '../contracts/social-user.model';

export const SOCIAL_PROFILE_REPOSITORY = Symbol('SOCIAL_PROFILE_REPOSITORY');

export type CreateSocialProfileInput = {
  user: SocialUserSummary;
  bio: string | null;
  victoryMessage: string | null;
  defeatMessage: string | null;
  visibility: SocialProfileVisibility;
};

export type SocialProfileEndgameMessages = {
  userId: number;
  victoryMessage: string | null;
  defeatMessage: string | null;
};

export interface SocialProfileRepository {
  findByUserId(userId: number): Promise<SocialProfileRecord | null>;
  findEndgameMessagesByUserIds(
    userIds: number[],
  ): Promise<SocialProfileEndgameMessages[]>;
  create(input: CreateSocialProfileInput): Promise<SocialProfileRecord>;
  save(profile: SocialProfileRecord): Promise<SocialProfileRecord>;
}
