import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
export declare class AdminUsersWsHandler {
    private readonly validator;
    private readonly users;
    private readonly catalogInvalidation;
    constructor(validator: PayloadValidationService, users: AdminUsersService, catalogInvalidation: AdminCatalogInvalidationService);
    usersList(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: import("../../user/entities/user.entity").User[];
            total: number;
            page: number;
            limit: number;
        };
    }>;
    usersGet(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            user: {
                id: number;
                email: string;
                roles: string[];
                username: string;
                avatar?: string | null | undefined;
                preferences?: (Record<string, unknown> | null) | undefined;
                emailVerified: boolean;
                bannedUntil?: (Date | null) | undefined;
                banReason?: string | null | undefined;
                chatBannedUntil?: (Date | null) | undefined;
                chatBanReason?: string | null | undefined;
                createdAt: Date;
            };
        };
    }>;
    usersBan(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            user: {
                id: number;
                email: string;
                roles: string[];
                username: string;
                avatar?: string | null | undefined;
                preferences?: (Record<string, unknown> | null) | undefined;
                emailVerified: boolean;
                bannedUntil?: (Date | null) | undefined;
                banReason?: string | null | undefined;
                chatBannedUntil?: (Date | null) | undefined;
                chatBanReason?: string | null | undefined;
                createdAt: Date;
            };
        };
    }>;
    usersUnban(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            user: {
                id: number;
                email: string;
                roles: string[];
                username: string;
                avatar?: string | null | undefined;
                preferences?: (Record<string, unknown> | null) | undefined;
                emailVerified: boolean;
                bannedUntil?: (Date | null) | undefined;
                banReason?: string | null | undefined;
                chatBannedUntil?: (Date | null) | undefined;
                chatBanReason?: string | null | undefined;
                createdAt: Date;
            };
        };
    }>;
    usersDelete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            deleted: boolean;
        };
    }>;
    usersUpdateRoles(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            user: {
                id: number;
                email: string;
                roles: string[];
                username: string;
                avatar?: string | null | undefined;
                preferences?: (Record<string, unknown> | null) | undefined;
                emailVerified: boolean;
                bannedUntil?: (Date | null) | undefined;
                banReason?: string | null | undefined;
                chatBannedUntil?: (Date | null) | undefined;
                chatBanReason?: string | null | undefined;
                createdAt: Date;
            };
        };
    }>;
}
