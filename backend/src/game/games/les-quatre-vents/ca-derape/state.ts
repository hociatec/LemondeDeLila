export type CaPendingKind = 'swap' | 'next-player' | 'next-delta' | 'mirror';

export interface CaDerapeState {
  lastRollByPlayer: Record<number, number>;
  lastMoveDelta: Record<number, number>;
  turnsSinceMoved: Record<number, number>;
  skipTurns: Record<number, number>;
  ignoreNextPenalty: Record<number, boolean>;
  doubleNextMove: Record<number, boolean>;
  doubleNextRoll: Record<number, boolean>;
  mirrorNextRollFrom: Record<number, number | null>;
  nextPlayerDelta: number | null;
  pendingKind: CaPendingKind | null;
  pendingActorId: number | null;
  extraTurn: boolean;
  winnerId: number | null;
}

export type CaDerapePlayerView = CaDerapeState & {
  positions: Record<number, number>;
  deckCount: number;
};
