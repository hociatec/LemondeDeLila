export type PirateTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'treasure'
  | 'obstacle'
  | 'gold'
  | 'finish';

export interface PirateTile {
  n: number;
  title: string;
  description: string;
  type: PirateTileType;
}

export interface PirateCard {
  id: number;
  title: string;
  description: string;
}

export interface PirateCollection {
  treasures: PirateCard[];
  obstacles: PirateCard[];
  bonus: PirateCard[];
  goldPieces: number;
}

export type PiratePendingEffect =
  | { kind: 'target-move'; actorId: number; delta: number }
  | { kind: 'steal-treasure'; actorId: number };

export interface PiratesState {
  collections: Record<number, PirateCollection>;
  skipTurns: Record<number, number>;
  obstacleImmunity: Record<number, number>;
  lastRoll: number | null;
  winnerId: number | null;
  pendingEffect: PiratePendingEffect | null;
}

export type PiratesPlayerView = Omit<PiratesState, 'pendingEffect'> & {
  positions: Record<number, number>;
  deckCounts: Record<'treasure' | 'obstacle' | 'bonus', number>;
};
