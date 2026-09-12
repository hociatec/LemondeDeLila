/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type OlympiaCard = {
  id: string;
  category: string;
  deck: string;
  points?: number;
  effects: readonly GameEffectInstruction[];
};
export type OlympiaProgram = {
  handId: string;
  deckIds: readonly string[];
  targetScore: number;
  winnerReason: string;
  cards: readonly OlympiaCard[];
};
