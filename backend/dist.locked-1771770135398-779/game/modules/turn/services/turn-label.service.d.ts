import { GameStateEntity } from '../../../core/entities/game-state.entity';
export declare class TurnLabelService {
    private sanitizePlayerName;
    compute(state: GameStateEntity, gameType: string): string | null;
}
