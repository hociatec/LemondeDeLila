import type { LesMainsFamily } from './content';

export interface LesMainsState {
  completedFamilies: Record<number, LesMainsFamily[]>;
  skipTurns: Record<number, number>;
  extraDraws: Record<number, number>;
  freeFamilyRequest: Record<number, boolean>;
  vanishedProfessionUsed: Record<number, boolean>;
  gameOver: boolean;
  winnerIds: number[];
}

export type LesMainsPlayerView = LesMainsState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
