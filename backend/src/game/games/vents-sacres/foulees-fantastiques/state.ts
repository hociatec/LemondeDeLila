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
  moves: Array<{ pawnIndex: number; targetProgress: number }>;
}

export interface FouleesState {
  trackLength: number;
  homeLength: number;
  pawnsByPlayer: Record<number, FouleesPawn[]>;
  colorsByPlayer: Record<number, FouleesColor>;
  familyIdByPlayer: Record<number, string>;
  offsets: Record<number, number>;
  safeTiles: number[];
  setupComplete: boolean;
  lastRoll: number | null;
  winnerId: number | null;
  pendingMove: FouleesPendingMove | null;
}

export type FouleesPlayerView = Omit<FouleesState, 'pendingMove'> & {
  positions: Record<number, number>;
  arrived: Record<number, number>;
};
