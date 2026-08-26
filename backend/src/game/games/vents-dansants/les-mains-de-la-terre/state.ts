import type { PlayerMap } from '../../../core/application/public-api';

export type LesMainsState = Record<string, never>;

export type LesMainsPlayerView = {
  extraDraws: PlayerMap<number>;
  freeFamilyRequest: PlayerMap<boolean>;
  vanishedProfessionUsed: PlayerMap<boolean>;
};
