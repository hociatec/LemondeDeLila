import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type PublicDomainCardCategory =
  'tresor' | 'objet' | 'event' | 'monster' | 'collapse';

export type PublicDomainCardsProgram = {
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
