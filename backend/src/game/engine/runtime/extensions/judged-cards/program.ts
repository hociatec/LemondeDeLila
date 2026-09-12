/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
/** A rotating judge selects among hidden card submissions, then a new round opens. */
export type JudgedCardsProgram = {
  judgeId: string;
  submissionId: string;
  promptDeckId: string;
  answerDeckId: string;
  answerHandId: string;
  collectingPhase: string;
  judgingPhase: string;
  scoreToWin: number;
  winningReason: string;
  submittedMessage: string;
  revealedEvent: string;
  botSelection: 'first' | 'random';
};
