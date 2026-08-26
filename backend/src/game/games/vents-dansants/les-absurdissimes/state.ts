export type AbsurdissimesStage = 'play' | 'judge';

export interface AbsurdissimesState {
  currentWhite: string | null;
  judgeIndex: number;
  roundStage: AbsurdissimesStage;
  submissions: Record<number, string>;
  scores: Record<number, number>;
  targetScore: number;
  remainingPlayers: number[];
  winnerId: number | null;
}

export interface AbsurdissimesPlayerView extends AbsurdissimesState {
  hand: string[];
  handCounts: Record<number, number>;
  submissionCount: number;
}
