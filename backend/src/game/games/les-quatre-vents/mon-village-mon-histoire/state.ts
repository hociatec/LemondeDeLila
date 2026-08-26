import type { PlayerMap } from '../../../core/application/public-api';

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

export type MonVillageState = Record<string, never>;

export type MonVillagePlayerView = {
  collections: PlayerMap<VillageCollection>;
  availableCards: Record<number, number>;
};
