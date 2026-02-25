export declare class User {
    id: number;
    email: string;
    roles: string[];
    password: string;
    username: string;
    avatar?: string | null;
    preferences?: Record<string, unknown> | null;
    emailVerified: boolean;
    bannedUntil?: Date | null;
    banReason?: string | null;
    chatBannedUntil?: Date | null;
    chatBanReason?: string | null;
    createdAt: Date;
}
