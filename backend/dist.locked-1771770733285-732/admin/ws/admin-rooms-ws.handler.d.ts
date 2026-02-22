import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { RoomService } from '../../room/services/room.service';
import { RoomMaintenanceSettingsService } from '../../room/services/room-maintenance-settings.service';
export declare class AdminRoomsWsHandler {
    private readonly validator;
    private readonly rooms;
    private readonly roomSettings;
    constructor(validator: PayloadValidationService, rooms: RoomService, roomSettings: RoomMaintenanceSettingsService);
    roomsCleanup(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            matched: number;
            deleted: number;
            roomIds: number[];
        };
    }>;
    roomsList(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: Array<{
                id: number;
                name: string;
                gameType: string;
                status: string;
                isPrivate: boolean;
                maxPlayers: number;
                playersCount: number;
                botsCount: number;
                ownerUsername: string | null;
                activePlayers: number;
            }>;
        };
    }>;
    roomsDestroy(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: true;
            roomId: number;
        };
    }>;
    roomsSettingsGet(session: WsSession, payload: any): {
        type: string;
        payload: import("../../room/services/room-maintenance-settings.service").RoomMaintenanceSettings;
    };
    roomsSettingsUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: import("../../room/services/room-maintenance-settings.service").RoomMaintenanceSettings;
    }>;
}
