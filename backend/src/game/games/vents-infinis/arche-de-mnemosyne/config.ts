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
