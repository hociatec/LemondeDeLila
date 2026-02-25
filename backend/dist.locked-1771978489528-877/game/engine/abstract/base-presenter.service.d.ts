import type { GameStateEntity, PendingState } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../dto/game-action.dto';
export declare abstract class BasePresenterService {
    protected buildExposedState(state: GameStateEntity, actions?: GameSingleActionDto[]): GameStateWithActions;
    protected buildExposedStateForUser(state: GameStateEntity, userId: number, actions?: GameSingleActionDto[]): GameStateWithActions;
    protected formatActions(actions: GameSingleActionDto[]): Array<{
        type: string;
        label: string;
        payload: Record<string, unknown>;
    }>;
    protected getActionLabel(actionType: string): string;
    protected isStarted(state: GameStateEntity): boolean;
    protected getCurrentPlayerId(state: GameStateEntity): number | null;
    protected getMetadata(state: GameStateEntity): Record<string, unknown>;
    protected getBaseExtras(state: GameStateEntity): Record<string, unknown>;
    protected abstract buildCatalog(): {
        phases: string[];
        victory: unknown;
    };
    protected getAvailableActions(_state: GameStateEntity, _currentPlayerId: number | null): GameSingleActionDto[];
    protected getAvailableActionsForUser(state: GameStateEntity, userId: number): GameSingleActionDto[];
    protected abstract buildPendingState(state: GameStateEntity, metadata: Record<string, unknown>, currentPlayerId: number | null): PendingState | null;
    protected buildPendingStateForUser(state: GameStateEntity, metadata: Record<string, unknown>, userId: number, currentPlayerId: number | null): PendingState | null;
    protected shouldExposePendingToUser(pending: PendingState | null, userId: number): boolean;
    protected filterPendingForUser(pending: PendingState | null, userId: number, fallback?: PendingState | null): PendingState | null;
    protected abstract buildExtras(state: GameStateEntity, metadata: Record<string, unknown>, currentPlayerId: number | null): Record<string, unknown>;
    protected buildCurrentPlayerView(state: GameStateEntity, currentPlayerId: number | null): {
        id: number;
        username: string;
    } | null;
    protected buildExtrasForUser(state: GameStateEntity, metadata: Record<string, unknown>, _userId: number, currentPlayerId: number | null): Record<string, unknown>;
}
