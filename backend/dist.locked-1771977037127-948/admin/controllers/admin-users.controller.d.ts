import { AdminUsersService } from '../services/admin-users.service';
import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { AdminListUsersDto } from '../dto/admin-list-users.dto';
import { AdminBanUserDto } from '../dto/admin-ban-user.dto';
export declare class AdminUsersController {
    private readonly adminUsers;
    constructor(adminUsers: AdminUsersService);
    list(query: AdminListUsersDto): Promise<{
        items: import("../../user/entities/user.entity").User[];
        total: number;
        page: number;
        limit: number;
    }>;
    get(id: number): Promise<{
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
    }>;
    create(body: AdminCreateUserDto): Promise<{
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
        temporaryPassword: string | undefined;
    }>;
    update(id: number, body: AdminUpdateUserDto): Promise<{
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
    }>;
    resetPassword(id: number): Promise<{
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
        temporaryPassword: string;
    }>;
    delete(id: number): Promise<{
        deleted: boolean;
    }>;
    ban(id: number, body: AdminBanUserDto): Promise<{
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
    }>;
    unban(id: number): Promise<{
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
    }>;
}
