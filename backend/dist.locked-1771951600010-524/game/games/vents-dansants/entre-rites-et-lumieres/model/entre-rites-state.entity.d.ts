import type { RiteFamilyId } from './entre-rites-cards';
export interface EntreRitesMetadata {
    rng?: Record<string, unknown>;
    deck: string[];
    discard: string[];
    hands: Record<number, string[]>;
    familyCollections: Record<number, Record<RiteFamilyId, string[]>>;
    completedFamilies: Record<number, string[]>;
    specialsPlayed: Record<number, string[]>;
    specialsPlayedCount: Record<number, number>;
    drawnPlayerId?: number | null;
    winnerId?: number | null;
    peaceTurnsRemaining?: number;
    silenceUntilPlayerId?: number | null;
}
export declare const ENTRE_RITES_TOTAL_FAMILIES = 5;
