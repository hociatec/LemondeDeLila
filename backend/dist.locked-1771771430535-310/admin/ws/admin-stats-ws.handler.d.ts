import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
export declare class AdminStatsWsHandler {
    private readonly stats;
    constructor(stats: GameStatsService);
    statsResetAll(session: WsSession): Promise<{
        type: string;
        payload: {
            ok: boolean;
            deletedPlayers: number;
            deletedMatches: number;
        };
    }>;
}
