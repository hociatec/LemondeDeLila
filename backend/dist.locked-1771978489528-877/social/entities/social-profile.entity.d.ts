import { User } from '../../user/entities/user.entity';
export type SocialProfileVisibility = 'public' | 'friends' | 'private';
export declare class SocialProfile {
    userId: number;
    user: User;
    bio?: string | null;
    visibility: SocialProfileVisibility;
    createdAt: Date;
    updatedAt: Date;
}
