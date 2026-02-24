export declare class AdminUpdateUserDto {
    email?: string;
    username?: string;
    password?: string;
    roles?: string[];
    avatar?: string | null;
    emailVerified?: boolean;
    bannedUntil?: string | null;
    banReason?: string | null;
}
