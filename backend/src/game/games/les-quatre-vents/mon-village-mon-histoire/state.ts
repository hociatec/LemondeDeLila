export type VillageTile = {
  n: number;
  title: string;
  description: string;
  type: 'card' | 'finish';
};

export type VillageCard = {
  id: number;
  title: string;
  description: string;
  zoneId: number;
};

export type VillageCollection = {
  total: number;
  byZone: Record<number, number>;
};

export interface MonVillageState {
  collections: Record<number, VillageCollection>;
  lastRoll: number | null;
  winnerId: number | null;
}

export type MonVillagePlayerView = MonVillageState & {
  positions: Record<number, number>;
  availableCards: Record<number, number>;
};
