export type MonVillageTileType = 'card' | 'finish';

export type MonVillageTile = {
  n: number;
  title: string;
  description: string;
  type: MonVillageTileType;
};

export type MonVillageCard = {
  id: number;
  title: string;
  description: string;
  zoneId: number;
};

export type MonVillageDecks = Record<number, MonVillageCard[]>;
export type MonVillageDiscards = Record<number, MonVillageCard[]>;

export type MonVillageCollection = {
  total: number;
  byZone: Record<number, number>;
};

export type MonVillagePendingContext = null;

export type MonVillageMetadata = {
  tiles: MonVillageTile[];
  positions: Record<number, number>;
  statuses: { skipTurn: Record<number, number> };
  decks: MonVillageDecks;
  discards: MonVillageDiscards;
  collections: Record<number, MonVillageCollection>;
  pendingContext: MonVillagePendingContext;
  winnerId: number | null;
};
