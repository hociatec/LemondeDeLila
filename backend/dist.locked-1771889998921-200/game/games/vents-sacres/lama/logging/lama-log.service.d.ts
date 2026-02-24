import { GameLogEntry } from '../../../../core/entities/game-state.entity';
export declare class LamaLogService {
    append(log: GameLogEntry[] | undefined, message: string): GameLogEntry[];
    private buildEntry;
}
