import { User } from '../../user/entities/user.entity';
import { GameMatchPlayer } from './game-match-player.entity';
export declare class GameMatch {
    id: number;
    roomId: number;
    gameType: string;
    withBots: boolean;
    botsCount: number;
    humansCount: number;
    startedAt: Date;
    endedAt?: Date | null;
    endedReason?: string | null;
    winnerUser?: User | null;
    players: GameMatchPlayer[];
}
