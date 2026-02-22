import { Repository } from 'typeorm';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
export declare class AdminClientUpdatesWsHandler {
    private readonly validator;
    private readonly notifications;
    private readonly clientUpdates;
    private readonly userRepo;
    private scheduledTimer;
    private scheduledAtMs;
    private warningTimer;
    private warningAtMs;
    constructor(validator: PayloadValidationService, notifications: NotificationService, clientUpdates: ClientUpdatesService, userRepo: Repository<User>);
    clientUpdateAnnounce(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            delivered: number;
        };
    }>;
    clientUpdateForceLatest(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            delivered: number;
            minRequiredVersion: string;
        };
    }>;
    clientUpdateSchedule(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            delivered: number;
            scheduledAt: string;
            delaySeconds: number;
        };
    }>;
}
