export interface MineDomain {
  treasures: string[];
  objects: string[];
}

export interface GrandeMineState {
  domains: Record<number, MineDomain>;
  drawnPlayerId: number | null;
  skipTurns: Record<number, number>;
  discardNextDraw: Record<number, boolean>;
  gameOver: boolean;
  winnerIds: number[];
}

export type GrandeMinePlayerView = GrandeMineState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
  scores: Record<number, number>;
};
