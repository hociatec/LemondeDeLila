export type NawakChallenge = {
  id: string;
  prompt: string;
  answers: readonly [string, string, string];
};

export type NawakProgram = {
  answerSubmissionId: string;
  voteSubmissionId: string;
  targetScore: number;
  winnerReason: string;
  challenges: readonly NawakChallenge[];
};
