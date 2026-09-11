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

export type MonVillageState =
  import('../../../engine/sdk/public-api').NoGameState;
