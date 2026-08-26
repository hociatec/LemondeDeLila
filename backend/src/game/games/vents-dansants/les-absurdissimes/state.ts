import type { PlayerMap } from '../../../core/application/public-api';

export type AbsurdissimesStage = 'play' | 'judge';

export type AbsurdissimesState = Record<string, never>;

export interface AbsurdissimesPlayerView {
  currentWhite: string | null;
  roundStage: AbsurdissimesStage;
  scores: PlayerMap<number>;
  targetScore: number;
  remainingPlayers: number[];
  winnerId: number | null;
}
