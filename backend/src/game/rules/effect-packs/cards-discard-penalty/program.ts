export type DiscardPenaltyCardsCard = number | string;

export type DiscardPenaltyCardsConfig = {
  loseAtScore: number;
  roundPauseSeconds: number;
  allowPlayAfterDraw: boolean;
  startingHandSize: number;
  copiesPerCardValue: number;
  returnTokenFromRound: number;
};
export type DiscardPenaltyCardsProgram = {
  deckId: string;
  handId: string;
  returnChoiceId: string;
  pauseChoiceId: string;
  drawnTurnFlag: string;
  orderedValues: readonly DiscardPenaltyCardsCard[];
  specialValue: DiscardPenaltyCardsCard;
  specialScore: number;
  cards: readonly DiscardPenaltyCardsCard[];
  defaults: DiscardPenaltyCardsConfig;
};
