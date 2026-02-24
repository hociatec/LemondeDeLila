import { Repository } from 'typeorm';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
export declare class AdminBroadcastWsHandler {
    private readonly validator;
    private readonly notifications;
    private readonly userRepo;
    constructor(validator: PayloadValidationService, notifications: NotificationService, userRepo: Repository<User>);
    broadcast(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            delivered: number;
        };
    }>;
}
