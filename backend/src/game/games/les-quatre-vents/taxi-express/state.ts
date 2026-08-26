import type { TaxiClient, TaxiEvent } from './content';

export interface TaxiState {
  activeClients: Record<number, TaxiClient | null>;
  completedTrips: Record<number, number>;
  lastEvent: TaxiEvent | null;
  lastRoll: number | null;
  winnerId: number | null;
}

export type TaxiPlayerView = Omit<TaxiState, 'activeClients'> & {
  positions: Record<number, number>;
  activeClient: TaxiClient | null;
  hasActiveClient: Record<number, boolean>;
};
