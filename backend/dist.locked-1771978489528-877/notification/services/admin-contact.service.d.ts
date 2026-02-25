import { Repository } from 'typeorm';
import type { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { NotificationService } from './notification.service';
import { User } from '../../user/entities/user.entity';
import { NotificationInboxDbService } from './notification-inbox-db.service';
import { UserBadgeCountsService } from './user-badge-counts.service';
export type AdminContactItem = {
    kind: 'admin_contact';
    contactId: string;
    message: string;
    fromUserId: number;
    fromUsername: string;
    toUserId?: number;
    id: string;
    createdAt: string;
    readAt?: string | null;
    status?: AdminContactStatus;
    handled?: boolean;
    statusAt?: string | null;
    statusByUserId?: number | null;
    statusByUsername?: string | null;
    handledAt?: string | null;
    handledByUserId?: number | null;
    handledByUsername?: string | null;
};
export type AdminContactThreadSummary = {
    kind: 'admin_contact';
    contactId: string;
    latestId: string;
    latestCreatedAt: string;
    latestReadAt?: string | null;
    latestMessage: string;
    fromUserId: number;
    fromUsername: string;
    toUserId?: number | null;
    unreadCount: number;
    status: AdminContactStatus;
    handled: boolean;
    statusAt?: string | null;
    statusByUserId?: number | null;
    statusByUsername?: string | null;
    handledAt?: string | null;
    handledByUserId?: number | null;
    handledByUsername?: string | null;
};
export type AdminContactStatus = 'open' | 'in_progress' | 'handled';
export declare class AdminContactService {
    private readonly notifications;
    private readonly inbox;
    private readonly counts;
    private readonly users;
    private readonly logger;
    private static readonly ADMIN_CONTACT_KIND;
    constructor(notifications: NotificationService, inbox: NotificationInboxDbService, counts: UserBadgeCountsService, users: Repository<User>);
    private isStaffRoles;
    private listStaffUserIds;
    private static normalizeContactStatus;
    private static normalizeContactPayload;
    listInbox(userId: number, limit?: number): Promise<any[]>;
    listThreads(userId: number, { maxItems, limitThreads, }?: {
        maxItems?: number;
        limitThreads?: number;
    }): Promise<AdminContactThreadSummary[]>;
    cycleStatusForContact(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, contactId: string): Promise<{
        status: 'open' | 'in_progress' | 'handled';
    }>;
    cycleStatusForInboxItem(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, userId: number, inboxItemId: string): Promise<{
        status: AdminContactStatus;
    }>;
    setStatusForInboxItem(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, userId: number, inboxItemId: string, status: unknown): Promise<void>;
    deleteInboxItem(userId: number, id: string): Promise<void>;
    markRead(userId: number, id: string): Promise<void>;
    sendFromUserToStaff(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, message: string, contactId?: string): Promise<AdminContactItem>;
    replyFromStaffToUser(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, toUserId: number, message: string, contactId: string): Promise<AdminContactItem>;
    setHandledForContact(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, contactId: string, handled: boolean): Promise<void>;
    setStatusForContact(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, contactId: string, status: unknown): Promise<void>;
    deleteThreadForContact(from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>, contactId: string): Promise<void>;
}
