export interface FouleesPawn {
  pawnIndex: number;
  progress: number;
}

export interface FouleesPendingMove {
  actorId: number;
}

export type FouleesState = import('../../../engine/sdk/public-api').NoGameState;
