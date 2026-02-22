import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
export declare class CorridorActionService {
    private toCellRef;
    private static toColumnLetters;
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private applyOne;
    private applyMove;
    private applyWall;
    private advanceTurnAndMaybeFinish;
}
