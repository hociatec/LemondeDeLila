import { Repository } from 'typeorm';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { ChatService } from '../../chat/services/chat.service';
import { ChatSettingsService } from '../../chat/services/chat-settings.service';
import { User } from '../../user/entities/user.entity';
export declare class AdminChatWsHandler {
    private readonly validator;
    private readonly chat;
    private readonly chatSettings;
    private readonly userRepo;
    constructor(validator: PayloadValidationService, chat: ChatService, chatSettings: ChatSettingsService, userRepo: Repository<User>);
    chatMessages(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            messages: {
                id: string;
                text: string;
                createdAt: string;
                deletedAt: string | null;
                user: {
                    id: number;
                    username: string;
                    avatar: string | null;
                    chatBannedUntil: string | null;
                    chatBanReason: string | null;
                };
            }[];
        };
    }>;
    chatSettingsGet(session: WsSession, payload: any): {
        type: string;
        payload: import("../../chat/services/chat-settings.service").ChatSettings;
    };
    chatSettingsUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: import("../../chat/services/chat-settings.service").ChatSettings;
    }>;
    chatDelete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
    chatClear(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            deleted: number;
        };
    }>;
    chatBan(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
            userId: number;
            chatBannedUntil: string;
            chatBanReason: string | null;
            byUserId: number;
        };
    }>;
    chatUnban(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
            userId: number;
            byUserId: number;
        };
    }>;
}
