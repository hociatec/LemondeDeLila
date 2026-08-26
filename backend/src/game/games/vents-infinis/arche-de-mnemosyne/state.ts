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

export type MnemoGameConfig = MnemoConfig & { categoryId: string };

export type MnemoPublicQuestion = {
  id: string;
  prompt: string;
  choices: readonly string[];
};

export type MnemoState = Record<string, never>;

export type MnemoPlayerView = {
  currentQuestion: MnemoPublicQuestion | null;
  answeredPlayerIds: number[];
  notBeforeMs: number | null;
  questionLeaderId: number;
  remainingMilliseconds: number | null;
  categories: Array<{ id: string; name: string }>;
};
