import type { GameStateEntity, PendingState } from '../../../core/entities/game-state.entity';
export declare function createPendingState(state: GameStateEntity, pending: PendingState): GameStateEntity;
export declare function clearPendingState(state: GameStateEntity): GameStateEntity;
export declare function resolvePendingState(state: GameStateEntity, resolver: (state: GameStateEntity, pending: PendingState) => GameStateEntity): GameStateEntity;
export declare function getPendingType(state: GameStateEntity): string;
export declare function isPendingType(state: GameStateEntity, type: string): boolean;
export declare class PendingActionService<TAction = unknown> {
    private pending;
    set(playerId: number, action: TAction): void;
    get(playerId: number): TAction | undefined;
    clear(playerId: number): void;
}
