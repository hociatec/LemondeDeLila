import type { GameStateEntity } from '../../../core/entities/game-state.entity';
export type ExchangeTarget = {
    targetPlayerId: number;
    targetUsername: string;
};
export type InteractiveExchangePending = {
    type: 'exchange';
    step: 'choose_target';
    blocking: true;
    label?: string | null;
    playerId: number;
    card: string;
    targets: ExchangeTarget[];
} | {
    type: 'exchange';
    step: 'choose_give';
    blocking: true;
    label?: string | null;
    playerId: number;
    card: string;
    targetPlayerId: number;
    targetUsername: string;
    giveChoices: string[];
} | {
    type: 'exchange';
    step: 'confirm';
    blocking: true;
    label?: string | null;
    playerId: number;
    initiatorPlayerId: number;
    initiatorUsername: string;
    targetPlayerId: number;
    targetUsername: string;
    give: string;
    take: string | null;
    targetHadCards: boolean;
    bonusRequested: boolean;
};
export type InteractiveExchangeAdapter = {
    listTargets(state: GameStateEntity, playerId: number): ExchangeTarget[];
    getInventory(state: GameStateEntity, playerId: number): string[];
    removeFromInventory(state: GameStateEntity, playerId: number, card: string): GameStateEntity;
    addCardToPlayer(state: GameStateEntity, playerId: number, card: string): GameStateEntity;
    setSkipTurns?(state: GameStateEntity, playerId: number, turns: number): GameStateEntity;
};
export declare function defaultExchangeTargets(state: GameStateEntity, playerId: number): ExchangeTarget[];
export declare function defaultGetInventory(state: GameStateEntity, playerId: number): string[];
