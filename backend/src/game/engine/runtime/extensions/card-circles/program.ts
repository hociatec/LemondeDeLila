/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type CardCirclesProgram = {
  deckId: string;
  handId: string;
  inventoryId: string;
  cards: readonly { id: string; name: string; theme: string }[];
  themes: readonly string[];
  cardsPerCircle: number;
  circlesToWin: number;
  handMinimum: number;
  handLimit: number;
  finishReason: string;
  eventNamespace: string;
};
