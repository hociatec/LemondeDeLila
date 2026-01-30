export type PiratesEnVadrouilleTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'treasure'
  | 'obstacle'
  | 'gold'
  | 'finish';

export type PiratesEnVadrouilleTile = {
  n: number;
  title: string;
  description: string;
  type: PiratesEnVadrouilleTileType;
};

export type PiratesEnVadrouilleTreasureCard = {
  id: number;
  title: string;
  description: string;
};

export type PiratesEnVadrouilleObstacleCard = {
  id: number;
  title: string;
  description: string;
};

export type PiratesEnVadrouilleBonusCard = {
  id: number;
  title: string;
  description: string;
};

export type PiratesEnVadrouilleDecks = {
  treasure: PiratesEnVadrouilleTreasureCard[];
  obstacle: PiratesEnVadrouilleObstacleCard[];
  bonus: PiratesEnVadrouilleBonusCard[];
};

export type PiratesEnVadrouilleDiscards = {
  treasure: PiratesEnVadrouilleTreasureCard[];
  obstacle: PiratesEnVadrouilleObstacleCard[];
  bonus: PiratesEnVadrouilleBonusCard[];
};

export type PiratesEnVadrouilleCollection = {
  treasures: PiratesEnVadrouilleTreasureCard[];
  obstacles: PiratesEnVadrouilleObstacleCard[];
  bonus: PiratesEnVadrouilleBonusCard[];
  goldPieces: number;
};

export type PiratesEnVadrouilleStatuses = {
  skipTurn: Record<number, number>;
  obstacleImmunity: Record<number, number>;
};

export type PiratesEnVadrouillePendingContext =
  | {
      kind: 'target_move';
      actorId: number;
      delta: number;
    }
  | {
      kind: 'steal_treasure';
      actorId: number;
      count: number;
    };

export type PiratesEnVadrouilleMetadata = {
  tiles: PiratesEnVadrouilleTile[];
  positions: Record<number, number>;
  statuses: PiratesEnVadrouilleStatuses;
  decks: PiratesEnVadrouilleDecks;
  discards: PiratesEnVadrouilleDiscards;
  collections: Record<number, PiratesEnVadrouilleCollection>;
  pendingContext: PiratesEnVadrouillePendingContext | null;
  winnerId: number | null;
  keepTurn?: boolean;
};
