import type { ZigEtZagMetadata, ZigEtZagRoundState } from './model/zig-et-zag-state.entity';
export declare function buildInitialRoundState(metadata: ZigEtZagMetadata, players: Array<{
    id?: number | null;
}>): ZigEtZagRoundState;
export declare function getPlayerHand(metadata: ZigEtZagMetadata, playerId: number): string[];
export declare function getPlayerHandSize(metadata: ZigEtZagMetadata, playerId: number): number;
export declare function playerHasCard(metadata: ZigEtZagMetadata, playerId: number, cardId: string): boolean;
export declare function removeCardFromHand(metadata: ZigEtZagMetadata, playerId: number, cardId: string): {
    metadata: ZigEtZagMetadata;
    removed: boolean;
};
export declare function getSelectableCards(metadata: ZigEtZagMetadata, playerId: number): string[];
export declare function isCardAllowed(round: ZigEtZagRoundState, playerId: number, cardId: string): boolean;
