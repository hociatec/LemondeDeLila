import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';

export type PublicDomainCardCategory = string;

export type PublicDomainCardsProgram = {
  collectibleCategories: readonly string[];
  lossCategory: string;
  deckId: string;
  handId: string;
  inventoryId: string;
  discardNextDrawStatus: string;
  handLimit: number;
  finishReason: string;
  eventNamespace: string;
  cards: readonly {
    id: string;
    name: string;
    category: PublicDomainCardCategory;
    description: string;
    points?: number | null;
    effects: readonly GameEffectInstruction[];
  }[];
};
