export type MnemosyneCategory = { id: string; name: string };
export type MnemosyneSourceQuestion = {
  id: string;
  categoryId: string;
  question: string;
  correct: string;
  wrong1: string;
  wrong2: string;
  wrong3: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};
export type MnemosyneConfig = {
  categoryId: string;
  targetPoints: number;
  useTimer: boolean;
  timerSeconds: number;
  interQuestionSeconds: number;
  correctSoloPoints: number;
  correctMultiPoints: number;
  wrongPoints: number;
  timeoutPoints: number;
};
export type MnemosyneProgram = {
  categories: readonly MnemosyneCategory[];
  questions: readonly MnemosyneSourceQuestion[];
  defaults: MnemosyneConfig;
};
