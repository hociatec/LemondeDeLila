import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
export declare class GerardPresidentPresenterService {
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private sanitizeSubmissions;
    private markJuryOverride;
    private buildHandCounts;
    private buildCatalog;
    private buildHandCards;
    private buildPlayerViews;
}
