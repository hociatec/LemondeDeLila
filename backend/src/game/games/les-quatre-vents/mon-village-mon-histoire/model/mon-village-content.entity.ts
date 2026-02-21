import type {
  MonVillageCard,
  MonVillageTile,
} from './mon-village-state.entity';

export type MonVillageBoardJsonV1 = {
  version: 1;
  tiles: MonVillageTile[];
};

export type MonVillageCardsJsonV1 = {
  version: 1;
  zones: Array<{
    id: number;
    title: string;
    cards: MonVillageCard[];
  }>;
};
