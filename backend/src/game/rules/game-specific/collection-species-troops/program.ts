import type { GameEffectInstruction } from '../../../engine/sdk/extension-contracts';

export type SpeciesSpecies = string;

export type SpeciesTroopsProgram = {
  deckId: string;
  handId: string;
  inventoryId: string;
  exchangeChoiceId: string;
  handLimit: number;
  victoryReason: string;
  species: readonly SpeciesSpecies[];
  cards: readonly {
    id: string;
    name: string;
    type: 'monkey' | 'action' | 'trap' | 'joker';
    species?: SpeciesSpecies;
    action?: string;
    trap?: string;
    effects: readonly GameEffectInstruction[];
  }[];
};
