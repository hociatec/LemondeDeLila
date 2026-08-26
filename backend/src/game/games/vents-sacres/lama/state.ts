export interface LamaConfig {
  loseAtScore: number;
  roundPauseSeconds: number;
  allowPlayAfterDraw: boolean;
  startingHandSize: number;
  copiesPerCardValue: number;
  returnTokenFromRound: number;
}

export interface LamaState {
  ownerId: number;
  configured: boolean;
  config: LamaConfig;
  scores: Record<number, number>;
  eliminated: Record<number, boolean>;
  droppedOut: Record<number, boolean>;
  drawnThisTurn: boolean;
  roundNumber: number;
  roundStarterIndex: number;
  step: 'setup' | 'turn' | 'return' | 'pause';
  roundWinnerId: number | null;
  winnerId: number | null;
}

export type LamaPlayerView = LamaState & {
  hand: number[];
  handCounts: Record<number, number>;
  topCard: number | null;
  deckCount: number;
};
