import { Repository } from 'typeorm';
import { NotificationInboxItem } from '../entities/notification-inbox-item.entity';
export type CreateInboxItemInput = {
    id: string;
    userId: number;
    kind: string;
    createdAt: Date;
    contactId?: string | null;
    fromUserId?: number | null;
    fromUsername?: string | null;
    toUserId?: number | null;
    message?: string | null;
    payload?: any;
};
export type InboxContactRow = {
    id: string;
    userId: number;
    kind: string;
    contactId: string | null;
    fromUserId: number | null;
    fromUsername: string | null;
    toUserId: number | null;
    message: string | null;
    payload: any;
    createdAt: Date;
    readAt: Date | null;
};
export declare class NotificationInboxDbService {
    private readonly repo;
    private readonly logger;
    constructor(repo: Repository<NotificationInboxItem>);
    create(input: CreateInboxItemInput): Promise<NotificationInboxItem>;
    list(userId: number, limit?: number): Promise<NotificationInboxItem[]>;
    getByIdForUser(userId: number, id: string): Promise<NotificationInboxItem | null>;
    markRead(userId: number, id: string): Promise<boolean>;
    delete(userId: number, id: string): Promise<boolean>;
    countUnread(userId: number): Promise<number>;
    listByContactId(kind: string, contactId: string): Promise<InboxContactRow[]>;
    updatePayload(id: string, payload: any): Promise<boolean>;
    deleteManyByIds(ids: string[]): Promise<number>;
}
