export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: readonly string[];
  answerIndex: number;
};
