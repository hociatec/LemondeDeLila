import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type SpeciesSpecies =
  'capucin' | 'mandrill' | 'gibbon' | 'babouin' | 'macaque';

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
    action?: 'vol-de-banane' | 'cris-de-la-jungle' | 'grimpeur-fou';
    trap?: 'piege-a-noix-de-coco' | 'tigre-rodeur';
    effects: readonly GameEffectInstruction[];
  }[];
};
