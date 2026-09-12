export type ZigEtZagCard = {
  id: string;
  name: string;
  type: string;
  color: string;
  family?: string;
  value: number;
  allowedFamilies?: readonly string[];
};

export type ZigEtZagProgram = {
  deckId: string;
  handId: string;
  totalCards: number;
  cards: readonly ZigEtZagCard[];
};
