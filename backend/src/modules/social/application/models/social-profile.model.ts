import type { SocialUserSummary } from './social-user.model';

export type SocialProfileVisibility = 'public' | 'friends' | 'private';

export type SocialProfileRecord = {
  userId: number;
  user: SocialUserSummary;
  bio: string | null;
  victoryMessage: string | null;
  defeatMessage: string | null;
  visibility: SocialProfileVisibility;
  createdAt: Date;
  updatedAt: Date;
};
/** Explicitly named data contract at the application boundary. */
