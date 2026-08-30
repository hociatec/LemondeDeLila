import type {
  SocialRelationshipRecord,
  SocialRelationshipStatus,
} from '../contracts/social-relationship.model';

export const SOCIAL_RELATIONSHIP_REPOSITORY = Symbol(
  'SOCIAL_RELATIONSHIP_REPOSITORY',
);

export type SocialDirection = 'incoming' | 'outgoing' | 'all';

export interface SocialRelationshipRepository {
  listAcceptedForUser(userId: number): Promise<SocialRelationshipRecord[]>;
  listPendingForUser(
    userId: number,
    direction: SocialDirection,
  ): Promise<SocialRelationshipRecord[]>;
  listBlockedByUser(userId: number): Promise<SocialRelationshipRecord[]>;
  findRelationsBetween(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord[]>;
  findPendingIncoming(
    userId: number,
    requesterId: number,
  ): Promise<SocialRelationshipRecord | null>;
  findPendingOutgoing(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord | null>;
  findBlocked(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord | null>;
  findAcceptedRelation(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord | null>;
  create(
    requesterId: number,
    addresseeId: number,
    status: SocialRelationshipStatus,
  ): Promise<SocialRelationshipRecord>;
  save(
    relationship: SocialRelationshipRecord,
  ): Promise<SocialRelationshipRecord>;
  remove(relationship: SocialRelationshipRecord): Promise<void>;
  removeMany(relationships: SocialRelationshipRecord[]): Promise<void>;
}
