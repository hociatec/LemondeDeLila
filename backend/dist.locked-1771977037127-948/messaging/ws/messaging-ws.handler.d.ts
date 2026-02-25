import { MessagingService } from '../services/messaging.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { UserBadgeCountsService } from '../../notification/services/user-badge-counts.service';
export declare class MessagingWsHandler {
    private readonly messaging;
    private readonly validator;
    private readonly notifications;
    private readonly counts;
    private readonly logger;
    constructor(messaging: MessagingService, validator: PayloadValidationService, notifications: NotificationService, counts: UserBadgeCountsService);
    conversation(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: import("../services/messaging.service").MessageDto[];
        };
    }>;
    messages(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            box: string;
            items: any[];
        };
    }>;
    send(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            message: import("../services/messaging.service").MessageDto;
        };
    }>;
    delete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            message: import("../services/messaging.service").MessageDto;
        };
    }>;
    restore(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            message: import("../services/messaging.service").MessageDto;
        };
    }>;
    purge(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            message: import("../services/messaging.service").MessageDto;
        };
    }>;
    search(payload: any): Promise<{
        type: string;
        payload: {
            user: import("../services/messaging.service").MessageUserDto | null;
        };
    }>;
    markRead(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
    private resolveBox;
}
