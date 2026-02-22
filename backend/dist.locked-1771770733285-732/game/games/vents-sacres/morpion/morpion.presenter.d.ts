import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../engine/abstract/base-presenter.service';
import { GridCellActionsService } from '../../../modules/grid/services/grid-cell-actions.service';
import type { MorpionMetadata } from './model/morpion.model';
export declare class MorpionPresenter extends BasePresenterService {
    private readonly gridCellActions;
    constructor(gridCellActions: GridCellActionsService);
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    protected buildCatalog(): {
        phases: string[];
        victory: any;
    };
    protected getAvailableActionsForUser(state: GameStateEntity, userId: number): GameSingleActionDto[];
    protected buildPendingState(): any;
    protected buildExtras(state: GameStateEntity, _metadata: MorpionMetadata, _currentPlayerId: number | null): Record<string, unknown>;
    protected buildExtrasForUser(state: GameStateEntity, _metadata: MorpionMetadata, _userId: number, currentPlayerId: number | null): Record<string, unknown>;
}
