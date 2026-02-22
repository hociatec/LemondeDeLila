import type { OlympiaDeckType, OlympiaStatusKey } from './olympia-cards';
export interface OlympiaStatus {
    key: OlympiaStatusKey;
    turns: number;
    value?: number;
}
export interface OlympiaMetadata {
    rng?: Record<string, any>;
    decks: Record<OlympiaDeckType, string[]>;
    discard: string[];
    hands: Record<number, string[]>;
    divinity: Record<number, string>;
    prestige: Record<number, number>;
    statuses: Record<number, OlympiaStatus[]>;
    skipTurn: Record<number, number>;
    winnerId?: number | null;
}
