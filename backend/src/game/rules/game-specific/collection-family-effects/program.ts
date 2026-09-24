import type { EffectCard } from '../../../engine/sdk/extension-contracts';

export type ProfessionFamilyCard = EffectCard<string> & {
  name: string;
  type: 'metier' | 'special';
  family?: string;
};
export type FamilyEffectsProgram = {
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
