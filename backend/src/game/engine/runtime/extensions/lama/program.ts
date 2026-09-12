/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type LamaCard = 1 | 2 | 3 | 4 | 5 | 6 | 'LAMA';

export type LamaConfig = {
  loseAtScore: number;
  roundPauseSeconds: number;
  allowPlayAfterDraw: boolean;
  startingHandSize: number;
  copiesPerCardValue: number;
  returnTokenFromRound: number;
};
export type LamaProgram = {
  deckId: string;
  handId: string;
  returnChoiceId: string;
  pauseChoiceId: string;
  drawnTurnFlag: string;
  cards: readonly LamaCard[];
  defaults: LamaConfig;
};
