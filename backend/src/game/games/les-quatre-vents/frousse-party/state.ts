import type { FrousseBlock } from './content';

export interface FrousseState {
  pawnByPlayerId: Record<number, string>;
  setupComplete: boolean;
  starterId: number;
  skipTurns: Record<number, number>;
  ignoreNextTrap: Record<number, boolean>;
  ignoreTrapUntilNextDraw: Record<number, boolean>;
  ignoreNextPrank: Record<number, boolean>;
  ignoreNextGhost: Record<number, boolean>;
  nextMoveCap: Record<number, number>;
  nextRollMalus: Record<number, number>;
  nextRollKeepLowest: Record<number, boolean>;
  nextRollDouble: Record<number, boolean>;
  nextRollIfThreeBackTwo: Record<number, boolean>;
  blocked: Record<number, FrousseBlock | null>;
  replayTurns: Record<number, number>;
  pendingSwap: { actorId: number; canDecline: boolean } | null;
  winnerId: number | null;
}

export type FroussePlayerView = Omit<FrousseState, 'pendingSwap'> & {
  positions: Record<number, number>;
  deckCount: number;
};
