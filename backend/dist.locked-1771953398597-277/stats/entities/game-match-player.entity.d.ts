import { User } from '../../user/entities/user.entity';
import { GameMatch } from './game-match.entity';
export type GameMatchOutcome = 'unknown' | 'won' | 'lost' | 'quit' | 'draw';
export declare class GameMatchPlayer {
    id: number;
    match: GameMatch;
    user: User;
    username: string;
    outcome: GameMatchOutcome;
    leftAt?: Date | null;
}
