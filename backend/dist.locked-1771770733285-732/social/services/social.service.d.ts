import { Repository } from 'typeorm';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { SocialProfileSettingsService } from './social-profile-settings.service';
import { SocialProfile, SocialProfileVisibility } from '../entities/social-profile.entity';
import { SocialRelationship } from '../entities/social-relationship.entity';
export declare class SocialService {
    private readonly relationships;
    private readonly profiles;
    private readonly users;
    private readonly notifications;
    private readonly profileSettings;
    constructor(relationships: Repository<SocialRelationship>, profiles: Repository<SocialProfile>, users: Repository<User>, notifications: NotificationService, profileSettings: SocialProfileSettingsService);
    listFriends(userId: number): Promise<{
        id: number;
        username: string;
        avatar: string | null;
        since: Date;
    }[]>;
    listRequests(userId: number, direction: 'incoming' | 'outgoing' | 'all'): Promise<{
        id: number;
        requester: {
            id: number;
            username: string;
            avatar: string | null;
        };
        addressee: {
            id: number;
            username: string;
            avatar: string | null;
        };
        createdAt: Date;
    }[]>;
    listBlocked(userId: number): Promise<{
        id: number;
        username: string;
        avatar: string | null;
        blockedAt: Date;
    }[]>;
    requestFriend(requesterId: number, addresseeId: number): Promise<{
        status: string;
        id?: undefined;
        createdAt?: undefined;
        updatedAt?: undefined;
    } | {
        id: number;
        status: import("../entities/social-relationship.entity").SocialRelationshipStatus;
        createdAt: Date;
        updatedAt?: undefined;
    } | {
        id: number;
        status: import("../entities/social-relationship.entity").SocialRelationshipStatus;
        updatedAt: Date;
        createdAt?: undefined;
    }>;
    acceptFriend(userId: number, requesterId: number): Promise<{
        id: number;
        status: import("../entities/social-relationship.entity").SocialRelationshipStatus;
        updatedAt: Date;
    }>;
    rejectFriend(userId: number, requesterId: number): Promise<{
        removed: boolean;
    }>;
    cancelRequest(userId: number, targetId: number): Promise<{
        removed: boolean;
    }>;
    removeFriend(userId: number, targetId: number): Promise<{
        removed: boolean;
    }>;
    blockUser(userId: number, targetId: number): Promise<{
        id: number;
        status: import("../entities/social-relationship.entity").SocialRelationshipStatus;
        updatedAt: Date;
    }>;
    unblockUser(userId: number, targetId: number): Promise<{
        removed: boolean;
    }>;
    getProfile(viewerId: number, targetId: number): Promise<{
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
        bio: string;
        visibility: SocialProfileVisibility;
        createdAt: Date;
        updatedAt: Date;
        isOwner: boolean;
        canView: boolean;
    }>;
    updateProfile(userId: number, bio?: string, visibility?: string): Promise<{
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
        bio: string;
        visibility: SocialProfileVisibility;
        createdAt: Date;
        updatedAt: Date;
        isOwner: boolean;
        canView: boolean;
    }>;
    searchUsers(query: string, userId: number): Promise<{
        id: number;
        username: string;
        avatar: string | null;
        profileVisibility: SocialProfileVisibility;
    }[]>;
    private ensureProfile;
    private canViewProfile;
    private findRelations;
    private findAcceptedRelation;
}
