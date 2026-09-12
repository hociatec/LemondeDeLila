export type SimultaneousQuizCategory = { id: string; name: string };
export type SimultaneousQuizSourceQuestion = {
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
export type SimultaneousQuizConfig = {
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
export type SimultaneousQuizProgram = {
  categories: readonly SimultaneousQuizCategory[];
  questions: readonly SimultaneousQuizSourceQuestion[];
  defaults: SimultaneousQuizConfig;
};
