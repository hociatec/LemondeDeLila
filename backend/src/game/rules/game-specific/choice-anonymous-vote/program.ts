export type AnonymousVoteChallenge = {
  id: string;
  prompt: string;
  answers: readonly string[];
};
export type AnonymousVoteProgram = {
  answerSubmissionId: string;
  voteSubmissionId: string;
  targetScore: number;
  winnerReason: string;
  challenges: readonly AnonymousVoteChallenge[];
};
