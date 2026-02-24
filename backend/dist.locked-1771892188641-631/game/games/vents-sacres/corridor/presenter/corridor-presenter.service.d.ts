import type { GameSingleActionDto, GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import type { CorridorMetadata } from '../model/corridor.model';
import { GridBlockedEdgesService } from '../../../../modules/grid/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../../../../modules/grid/services/grid-cell-actions.service';
export declare class CorridorPresenterService extends BasePresenterService {
    private readonly gridBlockedEdges;
    private readonly gridCellActions;
    constructor(gridBlockedEdges: GridBlockedEdgesService, gridCellActions: GridCellActionsService);
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private buildGridCellTags;
    protected buildCatalog(): {
        phases: string[];
        victory: any;
    };
    protected getAvailableActionsForUser(state: GameStateEntity, userId: number): GameSingleActionDto[];
    protected buildPendingState(): any;
    protected buildExtras(state: GameStateEntity, _metadata: CorridorMetadata, _currentPlayerId: number | null): Record<string, unknown>;
    protected buildExtrasForUser(state: GameStateEntity, _metadata: CorridorMetadata, _userId: number, _currentPlayerId: number | null): Record<string, unknown>;
}
