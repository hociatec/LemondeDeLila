import { Repository } from 'typeorm';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStateEntity } from '../../game/core/entities/game-state.entity';
import { User } from '../../user/entities/user.entity';
import { GameMatch } from '../entities/game-match.entity';
import { GameMatchPlayer } from '../entities/game-match-player.entity';
export type MyStatsCounts = {
    finished: number;
    quit: number;
    won: number;
    lost: number;
};
export type MyGameStats = {
    gameType: string;
    gameName: string;
    withBots: MyStatsCounts;
    withoutBots: MyStatsCounts;
};
export type LeaderboardGame = {
    gameType: string;
    gameName: string;
};
export type LeaderboardEntry = {
    userId: number;
    username: string;
    wins: number;
    losses: number;
    finished: number;
    quit: number;
};
export declare class GameStatsService {
    private readonly matches;
    private readonly players;
    private readonly users;
    private readonly catalog;
    private readonly logger;
    constructor(matches: Repository<GameMatch>, players: Repository<GameMatchPlayer>, users: Repository<User>, catalog: CatalogService);
    startMatch(params: {
        roomId: number;
        gameType: string;
        humans: Array<{
            id: number;
            username: string;
        }>;
        botsCount: number;
    }): Promise<GameMatch>;
    markQuit(roomId: number, userId: number): Promise<void>;
    endMatchOnReset(roomId: number): Promise<void>;
    finalizeFinished(roomId: number, state: GameStateEntity): Promise<void>;
    getMyStats(userId: number): Promise<MyGameStats[]>;
    getLeaderboardGames(): Promise<LeaderboardGame[]>;
    getTop10(gameType: string): Promise<LeaderboardEntry[]>;
    private resolveOutcome;
    private getActiveMatch;
    private closeActiveMatch;
    resetAllStats(): Promise<{
        deletedPlayers: number;
        deletedMatches: number;
    }>;
}
