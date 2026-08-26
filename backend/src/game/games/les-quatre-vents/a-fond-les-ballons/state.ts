export interface AFondLesBallonsState {
  pawnByPlayerId: Record<number, string>;
  setupComplete: boolean;
  starterId: number;
  skipTurns: Record<number, number>;
  trapImmunityTurns: Record<number, number>;
  lastRoll: number | null;
  extraTurn: boolean;
  swapPlayerId: number | null;
  winnerId: number | null;
}

export type AFondLesBallonsPlayerView = AFondLesBallonsState & {
  positions: Record<number, number>;
  deckCount: number;
};
