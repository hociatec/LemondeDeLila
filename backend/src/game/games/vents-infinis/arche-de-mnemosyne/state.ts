import type { PlayerMap } from '../../../core/application/public-api';

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

export interface MnemoState {}

export type MnemoPlayerView = {
  scores: PlayerMap<number>;
  currentQuestion: MnemoPublicQuestion | null;
  answeredPlayerIds: number[];
  notBeforeMs: number | null;
  roundNumber: number;
  questionLeaderId: number;
  remainingMilliseconds: number | null;
  categories: Array<{ id: string; name: string }>;
  winnerId: number | null;
};
