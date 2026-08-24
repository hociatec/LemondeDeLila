export type PrimalisTile = {
  n: number;
  title: string;
  description: string;
  type: 'comet';
};

export type PrimalisResources = {
  herbivores: number;
  carnivores: number;
  eggs: number;
  leaves: number;
};

export type PrimalisStatuses = {
  dangerAmplified: boolean;
};

export type PrimalisCollection = {
  resources: PrimalisResources;
};

export type PrimalisMetadata = {
  tiles: PrimalisTile[];
  positions: Record<number, number>;
  statuses: PrimalisStatuses;
  collections: Record<number, PrimalisResources>;
  pendingContext: null;
  winnerId: number | null;
};

