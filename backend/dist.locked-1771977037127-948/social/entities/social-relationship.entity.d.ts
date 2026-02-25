import { User } from '../../user/entities/user.entity';
export type SocialRelationshipStatus = 'pending' | 'accepted' | 'blocked';
export declare class SocialRelationship {
    id: number;
    requester: User;
    addressee: User;
    status: SocialRelationshipStatus;
    createdAt: Date;
    updatedAt: Date;
}
