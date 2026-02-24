import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { VaultRoomSnapshotsService } from '../services/vault-room-snapshots.service';
export declare class VaultWsHandler {
    private readonly validator;
    private readonly vault;
    constructor(validator: PayloadValidationService, vault: VaultRoomSnapshotsService);
    list(session: WsSession): Promise<{
        type: string;
        payload: {
            items: {
                id: string;
                name: string;
                roomName: string;
                gameType: string;
                playersLabel: string;
                createdAt: string;
            }[];
        };
    }>;
    save(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            id: string;
        };
    }>;
    restore(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roomId: number;
        };
    }>;
    delete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
    abandon(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
}
