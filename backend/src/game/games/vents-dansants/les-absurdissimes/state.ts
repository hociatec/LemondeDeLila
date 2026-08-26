export type AbsurdissimesStage = 'play' | 'judge';

export type AbsurdissimesState = Record<string, never>;

export interface AbsurdissimesPlayerView {
  currentWhite: string | null;
  roundStage: AbsurdissimesStage;
  targetScore: number;
  remainingPlayers: number[];
}
