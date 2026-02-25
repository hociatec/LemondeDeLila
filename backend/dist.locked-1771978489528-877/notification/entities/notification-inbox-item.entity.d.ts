import { User } from '../../user/entities/user.entity';
export declare class NotificationInboxItem {
    id: string;
    user: User;
    kind: string;
    contactId?: string | null;
    fromUserId?: number | null;
    fromUsername?: string | null;
    toUserId?: number | null;
    message?: string | null;
    payload?: any;
    createdAt: Date;
    readAt?: Date | null;
    deletedAt?: Date | null;
}
