import type { PlayerMap } from '../../../core/application/public-api';

export type RitesPendingChoice =
  | { kind: 'draw-one'; playerId: number; cardIds: string[] }
  | { kind: 'resurrection'; playerId: number }
  | { kind: 'free-family'; playerId: number }
  | { kind: 'reveal-and-steal'; playerId: number };

export type EntreRitesState = Record<string, never>;

export type EntreRitesPlayerView = {
  specialsPlayed: PlayerMap<string[]>;
  peaceTurnsRemaining: number;
  silenceOwnerId: number | null;
  winnerId: number | null;
};
