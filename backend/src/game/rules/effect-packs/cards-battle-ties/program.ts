export type BattleTiesCard = {
  id: string;
  name: string;
  type: string;
  color: string;
  family?: string;
  value: number;
  allowedFamilies?: readonly string[];
};
export type BattleTiesProgram = {
  deckId: string;
  handId: string;
  totalCards: number;
  cards: readonly BattleTiesCard[];
};
