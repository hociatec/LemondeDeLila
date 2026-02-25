import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { AdminListUsersDto } from '../dto/admin-list-users.dto';
import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
type SafeUser = Omit<User, 'password'>;
export declare class AdminUsersService {
    private readonly users;
    constructor(users: Repository<User>);
    private clearExpiredBans;
    list(query: AdminListUsersDto): Promise<{
        items: User[];
        total: number;
        page: number;
        limit: number;
    }>;
    get(id: number): Promise<SafeUser>;
    create(body: AdminCreateUserDto): Promise<{
        user: SafeUser;
        temporaryPassword: string | undefined;
    }>;
    update(id: number, body: AdminUpdateUserDto): Promise<SafeUser>;
    resetPassword(id: number): Promise<{
        user: SafeUser;
        temporaryPassword: string;
    }>;
    ban(id: number, reason: string, durationDays?: number, bannedUntil?: string | null): Promise<{
        user: SafeUser;
    }>;
    unban(id: number): Promise<{
        user: SafeUser;
    }>;
    delete(id: number): Promise<{
        deleted: boolean;
    }>;
    private ensureEmailAvailable;
    private ensureUsernameAvailable;
    private generatePassword;
    private omitPassword;
}
export {};
