import type { CatPattesBotType, CatPattesObstacleType } from './content';
import type { PlayerMap } from '../../../core/application/public-api';

export type CatPattesState = Record<string, never>;

export type CatPattesPlayerView = {
  obstacles: PlayerMap<CatPattesObstacleType | null>;
  powers: PlayerMap<CatPattesBotType[]>;
  turboPlayed: PlayerMap<number>;
  hasSun: PlayerMap<boolean>;
  sunReady: PlayerMap<boolean>;
  obstacleLock: PlayerMap<boolean>;
  positions: PlayerMap<number>;
  points: PlayerMap<number>;
  completedRounds: number;
  drawnPlayerId: number | null;
  winnerId: number | null;
};
