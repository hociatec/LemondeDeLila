import type { ZigEtZagColor, ZigEtZagFamily } from './zig-et-zag-cards';
export interface ZigEtZagPlayerPlay {
    playerId: number;
    playedCards: string[];
    faceDownCard?: string;
    faceUpCard?: string;
    invalidJoker?: boolean;
    lostByNoCard?: boolean;
}
export interface ZigEtZagRoundSummary {
    winnerId: number | null;
    cardsWon: number;
    plays: ZigEtZagPlayerPlay[];
    battleLog: string[];
}
export type ZigEtZagRoundStage = 'selection' | 'battle_face_down' | 'battle_face_up';
export interface ZigEtZagRoundState {
    stage: ZigEtZagRoundStage;
    plays: ZigEtZagPlayerPlay[];
    waitingPlayers: number[];
    tiedPlayers: number[];
    triggerColors: Record<number, ZigEtZagColor | undefined>;
    triggerFamilies: Record<number, ZigEtZagFamily | undefined>;
    battleLog: string[];
}
export interface ZigEtZagMetadata {
    rng?: Record<string, any>;
    playerDecks: Record<number, string[]>;
    initialDeckCounts?: Record<number, number>;
    roundState?: ZigEtZagRoundState | null;
    lastRound?: ZigEtZagRoundSummary | null;
    winnerId?: number | null;
}
