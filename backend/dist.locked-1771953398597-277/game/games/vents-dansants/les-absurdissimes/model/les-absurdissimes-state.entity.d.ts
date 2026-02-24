export type AbsurdissimesStage = 'play' | 'judge';
export interface AbsurdissimesMetadata {
    rng?: Record<string, any>;
    whiteDeck: string[];
    blackDeck: string[];
    discardWhite: string[];
    discardBlack: string[];
    blackHands: Record<number, string[]>;
    currentWhite?: string | null;
    judgeIndex: number;
    roundStage: AbsurdissimesStage;
    submissions: Record<number, string>;
    scores: Record<number, number>;
    targetScore: number;
    remainingPlayers: number[];
    winnerId?: number | null;
}
