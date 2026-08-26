import type { RiteFamilyId } from './content';

export type RitesPendingChoice =
  | { kind: 'draw-one'; playerId: number; cardIds: string[] }
  | { kind: 'resurrection'; playerId: number }
  | { kind: 'swap-hands'; playerId: number }
  | { kind: 'free-family'; playerId: number }
  | { kind: 'reveal-and-steal'; playerId: number };

export interface EntreRitesState {
  completedFamilies: Record<number, RiteFamilyId[]>;
  specialsPlayed: Record<number, string[]>;
  peaceTurnsRemaining: number;
  silenceOwnerId: number | null;
  pendingChoice: RitesPendingChoice | null;
  winnerId: number | null;
}

export type EntreRitesPlayerView = Omit<EntreRitesState, 'pendingChoice'> & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
