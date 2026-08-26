import type { PlayerMap } from '../../../core/application/public-api';

export interface MineDomain {
  treasures: string[];
  objects: string[];
}

export type GrandeMineState = Record<string, never>;

export type GrandeMinePlayerView = {
  domains: PlayerMap<MineDomain>;
  discardNextDraw: PlayerMap<boolean>;
  scores: PlayerMap<number>;
};
