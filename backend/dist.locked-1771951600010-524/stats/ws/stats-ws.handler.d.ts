import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { SocialService } from '../../social/services/social.service';
import { GameStatsService } from '../services/game-stats.service';
export declare class StatsWsHandler {
    private readonly stats;
    private readonly validator;
    private readonly social;
    constructor(stats: GameStatsService, validator: PayloadValidationService, social: SocialService);
    my(session: WsSession): Promise<{
        type: string;
        payload: {
            games: import("../services/game-stats.service").MyGameStats[];
        };
    }>;
    user(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            userId: number;
            games: import("../services/game-stats.service").MyGameStats[];
        };
    }>;
    leaderboardGames(): Promise<{
        type: string;
        payload: {
            games: import("../services/game-stats.service").LeaderboardGame[];
        };
    }>;
    leaderboardTop(payload: any): Promise<{
        type: string;
        payload: {
            gameType: string;
            entries: import("../services/game-stats.service").LeaderboardEntry[];
        };
    }>;
}
