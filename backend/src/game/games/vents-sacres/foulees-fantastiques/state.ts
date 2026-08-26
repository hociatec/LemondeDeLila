import type { PlayerMap } from '../../../core/application/public-api';

export type FouleesColor = 'Rouge' | 'Bleu' | 'Vert' | 'Jaune';

export interface FouleesPawn {
  pawnIndex: number;
  progress: number;
}

export interface FouleesFamily {
  id: string;
  family: string;
  habitat: string;
  pawns: readonly string[];
}

export interface FouleesPendingMove {
  actorId: number;
  roll: number;
}

export type FouleesState = Record<string, never>;

export type FouleesPlayerView = {
  pawnsByPlayer: PlayerMap<FouleesPawn[]>;
  colorsByPlayer: PlayerMap<FouleesColor>;
  familyIdByPlayer: PlayerMap<string>;
  offsets: PlayerMap<number>;
  trackLength: number;
  homeLength: number;
  safeTiles: number[];
  positions: PlayerMap<number>;
  arrived: PlayerMap<number>;
  winnerId: number | null;
  setupComplete: boolean;
  lastRoll: number | null;
};
