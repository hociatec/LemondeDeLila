import { Repository } from 'typeorm';
import { PrivateMessage } from '../../messaging/entities/private-message.entity';
import { NotificationService } from './notification.service';
import { NotificationInboxDbService } from './notification-inbox-db.service';
export declare class UserBadgeCountsService {
    private readonly inbox;
    private readonly messages;
    private readonly notifications;
    private readonly logger;
    constructor(inbox: NotificationInboxDbService, messages: Repository<PrivateMessage>, notifications: NotificationService);
    getCounts(userId: number): Promise<{
        unreadNotifications: number;
        unreadMessages: number;
    }>;
    notifyCounts(userId: number): Promise<void>;
}
