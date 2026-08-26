export type OdysseePawn = { pawnIndex: number; progress: number };

export interface OdysseeState {
  trackLength: number;
  homeLength: number;
  offsets: Record<number, number>;
  pawnsByPlayer: Record<number, OdysseePawn[]>;
  lastRoll: number | null;
  winnerId: number | null;
}

export type OdysseePlayerView = OdysseeState;
