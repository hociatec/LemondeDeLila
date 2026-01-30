import type { PrimalisTile } from './primalis-state.entity';

export type PrimalisBoardJsonV1 = {
  version: 1;
  tiles: PrimalisTile[];
};
