/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
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
