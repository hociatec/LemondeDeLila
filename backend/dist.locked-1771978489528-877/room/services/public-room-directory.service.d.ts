import { WsApiHubService } from '../../common/ws/ws-api-hub.service';
export declare class PublicRoomDirectoryService {
    private readonly hub;
    private readonly subscriptions;
    private pending;
    private flushTimer;
    private readonly flushDelayMs;
    constructor(hub: WsApiHubService);
    subscribe(connectionId: string, gameType?: string | null): void;
    unsubscribe(connectionId: string): void;
    notifyRefresh(roomId?: number | null, reason?: string | null): void;
    private flush;
}
