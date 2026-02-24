import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { BotService } from '../../bot/services/bot.service';
import { BotSettingsService } from '../../game/modules/bot/services/bot-settings.service';
export declare class AdminBotsWsHandler {
    private readonly validator;
    private readonly bots;
    private readonly botSettings;
    constructor(validator: PayloadValidationService, bots: BotService, botSettings: BotSettingsService);
    botsNamesList(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            names: {
                id: number;
                name: string;
                enabled: boolean;
                createdAt: Date;
            }[];
        };
    }>;
    botSettingsGet(session: WsSession, payload: any): {
        type: string;
        payload: import("../../game/modules/bot/services/bot-settings.service").BotSettings;
    };
    botSettingsUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: import("../../game/modules/bot/services/bot-settings.service").BotSettings;
    }>;
    botNameCreate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            names: {
                id: number;
                name: string;
                enabled: boolean;
                createdAt: Date;
            }[];
        };
    }>;
    botNameUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            names: {
                id: number;
                name: string;
                enabled: boolean;
                createdAt: Date;
            }[];
        };
    }>;
    botNameDelete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            names: {
                id: number;
                name: string;
                enabled: boolean;
                createdAt: Date;
            }[];
        };
    }>;
}
