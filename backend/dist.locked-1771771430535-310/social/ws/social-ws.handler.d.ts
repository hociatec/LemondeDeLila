import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { SocialService } from '../services/social.service';
export declare class SocialWsHandler {
    private readonly social;
    private readonly validator;
    constructor(social: SocialService, validator: PayloadValidationService);
    listFriends(session: WsSession): Promise<{
        type: string;
        payload: {
            items: {
                id: number;
                username: string;
                avatar: string | null;
                since: Date;
            }[];
        };
    }>;
    listRequests(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: {
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
            }[];
        };
    }>;
    listBlocked(session: WsSession): Promise<{
        type: string;
        payload: {
            items: {
                id: number;
                username: string;
                avatar: string | null;
                blockedAt: Date;
            }[];
        };
    }>;
    requestFriend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
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
        };
    }>;
    acceptFriend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            id: number;
            status: import("../entities/social-relationship.entity").SocialRelationshipStatus;
            updatedAt: Date;
        };
    }>;
    rejectFriend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            removed: boolean;
        };
    }>;
    cancelRequest(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            removed: boolean;
        };
    }>;
    removeFriend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            removed: boolean;
        };
    }>;
    blockFriend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            id: number;
            status: import("../entities/social-relationship.entity").SocialRelationshipStatus;
            updatedAt: Date;
        };
    }>;
    unblockFriend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            removed: boolean;
        };
    }>;
    getProfile(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            profile: {
                user: {
                    id: number;
                    username: string;
                    avatar: string | null;
                };
                bio: string;
                visibility: import("../entities/social-profile.entity").SocialProfileVisibility;
                createdAt: Date;
                updatedAt: Date;
                isOwner: boolean;
                canView: boolean;
            };
        };
    }>;
    updateProfile(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            profile: {
                user: {
                    id: number;
                    username: string;
                    avatar: string | null;
                };
                bio: string;
                visibility: import("../entities/social-profile.entity").SocialProfileVisibility;
                createdAt: Date;
                updatedAt: Date;
                isOwner: boolean;
                canView: boolean;
            };
        };
    }>;
    searchUsers(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: {
                id: number;
                username: string;
                avatar: string | null;
                profileVisibility: import("../entities/social-profile.entity").SocialProfileVisibility;
            }[];
        };
    }>;
}
