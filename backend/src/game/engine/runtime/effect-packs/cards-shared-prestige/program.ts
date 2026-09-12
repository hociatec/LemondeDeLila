import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type SharedPrestigeCardsCard = {
  id: string;
  category: string;
  deck: string;
  points?: number;
  effects: readonly GameEffectInstruction[];
};
export type SharedPrestigeCardsProgram = {
  handId: string;
  deckIds: readonly string[];
  targetScore: number;
  winnerReason: string;
  cards: readonly SharedPrestigeCardsCard[];
};
