import type { PlayerMap } from '../../../core/application/public-api';

export type OdysseePawn = { pawnIndex: number; progress: number };

export type OdysseeState = Record<string, never>;

export type OdysseePlayerView = {
  offsets: PlayerMap<number>;
  pawnsByPlayer: PlayerMap<OdysseePawn[]>;
  trackLength: number;
  homeLength: number;
  winnerId: number | null;
  lastRoll: number | null;
};
