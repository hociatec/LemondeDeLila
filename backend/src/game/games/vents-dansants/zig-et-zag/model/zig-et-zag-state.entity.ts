export interface ZigEtZagPlayerPlay {
  playerId: number;
  playedCards: string[];
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

export interface ZigEtZagMetadata {
  rng?: Record<string, any>;
  playerDecks: Record<number, string[]>;
  lastRound?: ZigEtZagRoundSummary | null;
  winnerId?: number | null;
}
