import type { TaxiClient, TaxiEvent } from './content';
import type { PlayerMap } from '../../../core/application/public-api';

export type TaxiState = Record<string, never>;

export type TaxiPlayerView = {
  completedTrips: PlayerMap<number>;
  lastEvent: TaxiEvent | null;
  lastRoll: number | null;
  positions: PlayerMap<number>;
  activeClient: TaxiClient | null;
  hasActiveClient: PlayerMap<boolean>;
  winnerId: number | null;
};
