import type { NawakChallenge } from './nawak-challenge.model';
export type NawakRoundStage = 'choose' | 'vote';
export interface NawakRoundSummary {
    challengeId: string;
    prompt: string;
    submissions: Record<number, number>;
    votes: Record<number, number>;
    pointsAwarded: Record<number, number>;
    tie: boolean;
}
export interface NawakMetadata {
    rng?: Record<string, any>;
    targetScore: number;
    scores: Record<number, number>;
    currentChallenge: NawakChallenge;
    roundStage: NawakRoundStage;
    submissions: Record<number, number>;
    votes: Record<number, number>;
    lastRound?: NawakRoundSummary | null;
    winnerId?: number | null;
}
