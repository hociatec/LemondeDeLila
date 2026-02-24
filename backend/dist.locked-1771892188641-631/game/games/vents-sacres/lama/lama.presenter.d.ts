import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../engine/abstract/base-presenter.service';
import type { LamaMetadata } from './model/lama.model';
export declare class LamaPresenter extends BasePresenterService {
    private sanitizePlayerName;
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private isSetup;
    protected buildCatalog(): {
        phases: string[];
        victory: any;
    };
    protected getAvailableActionsForUser(state: GameStateEntity, userId: number): GameSingleActionDto[];
    protected buildPendingState(_state: GameStateEntity, _metadata: LamaMetadata, _currentPlayerId: number | null): any;
    protected buildPendingStateForUser(state: GameStateEntity, metadata: LamaMetadata, userId: number, currentPlayerId: number | null): any;
    protected getActionLabel(actionType: string): string;
    protected buildExtras(state: GameStateEntity, _metadata: LamaMetadata, _currentPlayerId: number | null): Record<string, unknown>;
    protected buildExtrasForUser(state: GameStateEntity, metadata: LamaMetadata, userId: number, currentPlayerId: number | null): Record<string, unknown>;
    private topDiscard;
    private redactDrawLogForUser;
}
