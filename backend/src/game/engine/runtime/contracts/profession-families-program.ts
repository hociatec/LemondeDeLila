import type { GameEffectInstruction } from './effect-ir';

export type ProfessionFamilyCard = {
  id: string;
  name: string;
  type: 'metier' | 'special';
  family?: string;
  effects: readonly GameEffectInstruction[];
};

export type ProfessionFamiliesProgram = {
  deckId: string;
  handId: string;
  setsId: string;
  cards: readonly ProfessionFamilyCard[];
  familyIds: readonly string[];
  extraDrawResource: string;
  freeRequestStatus: string;
  vanishedStatus: string;
  finishReason: string;
  eventNamespace: string;
};
