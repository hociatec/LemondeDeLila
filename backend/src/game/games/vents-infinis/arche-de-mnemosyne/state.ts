export interface MnemoConfig {
  targetPoints: number;
  useTimer: boolean;
  timerSeconds: number;
  interQuestionSeconds: number;
  correctSoloPoints: number;
  correctMultiPoints: number;
  wrongPoints: number;
  timeoutPoints: number;
}

export type MnemoPublicQuestion = {
  id: string;
  prompt: string;
  choices: readonly string[];
};

export interface MnemoState {
  ownerId: number;
  config: MnemoConfig;
  categoryId: string | null;
  scores: Record<number, number>;
  currentQuestion: MnemoPublicQuestion | null;
  correctnessByPlayerId: Record<number, boolean>;
  answeredPlayerIds: number[];
  deadlineMs: number | null;
  notBeforeMs: number | null;
  roundNumber: number;
  questionLeaderId: number;
  winnerId: number | null;
}

export type MnemoPlayerView = Omit<
  MnemoState,
  'correctnessByPlayerId' | 'deadlineMs'
> & {
  remainingMilliseconds: number | null;
  categories: Array<{ id: string; name: string }>;
};
