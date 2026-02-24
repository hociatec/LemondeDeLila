import type { GameStateEntity } from '../core/entities/game-state.entity';
export declare function isStartedState(state: GameStateEntity): boolean;
export declare function getCurrentTurnPlayerId(state: GameStateEntity): number | null;
export declare function hasPendingState(state: GameStateEntity): boolean;
export declare function canPlayerActOnTurn(state: GameStateEntity, playerId: number, options?: {
    allowPending?: boolean;
}): boolean;
