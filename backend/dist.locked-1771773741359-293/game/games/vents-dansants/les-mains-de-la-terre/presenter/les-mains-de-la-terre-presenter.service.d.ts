import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
export declare class LesMainsPresenterService {
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private buildLabel;
    private buildFamilyCatalog;
    private buildHandCards;
    private buildPlayerViews;
}
