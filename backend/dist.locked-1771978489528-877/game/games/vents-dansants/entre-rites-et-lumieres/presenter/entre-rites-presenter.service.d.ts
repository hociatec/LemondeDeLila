import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
export declare class EntreRitesPresenterService {
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private buildCatalog;
    private buildHandCards;
    private buildPlayerViews;
}
