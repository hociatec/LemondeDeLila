import type { SocialUserSummary } from './social-user.model';

export type SocialRelationshipStatus = 'pending' | 'accepted' | 'blocked';

export type SocialRelationshipRecord = {
  id: number;
  requester: SocialUserSummary;
  addressee: SocialUserSummary;
  status: SocialRelationshipStatus;
  createdAt: Date;
  updatedAt: Date;
};
/** Explicitly named data contract at the application boundary. */
