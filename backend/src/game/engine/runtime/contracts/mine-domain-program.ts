import type { GameEffectInstruction } from './effect-ir';

export type MineCardCategory =
  'tresor' | 'objet' | 'event' | 'monster' | 'collapse';

export type MineDomainProgram = {
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
    category: MineCardCategory;
    description: string;
    points?: number | null;
    effects: readonly GameEffectInstruction[];
  }[];
};
