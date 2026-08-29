export interface FouleesFamily {
  id: string;
  family: string;
  habitat: string;
  pawns: readonly string[];
}

export interface FouleesPawn {
  pawnIndex: number;
  progress: number;
}

export interface FouleesPendingMove {
  actorId: number;
  roll: number;
}

export type FouleesState = import('../../../engine/sdk/public-api').NoGameState;
