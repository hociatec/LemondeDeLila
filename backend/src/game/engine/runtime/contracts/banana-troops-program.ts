import type { GameEffectInstruction } from './effect-ir';

export type BananaSpecies =
  'capucin' | 'mandrill' | 'gibbon' | 'babouin' | 'macaque';

export type BananaTroopsProgram = {
  deckId: string;
  handId: string;
  inventoryId: string;
  exchangeChoiceId: string;
  handLimit: number;
  victoryReason: string;
  species: readonly BananaSpecies[];
  cards: readonly {
    id: string;
    name: string;
    type: 'monkey' | 'action' | 'trap' | 'joker';
    species?: BananaSpecies;
    action?: 'vol-de-banane' | 'cris-de-la-jungle' | 'grimpeur-fou';
    trap?: 'piege-a-noix-de-coco' | 'tigre-rodeur';
    effects: readonly GameEffectInstruction[];
  }[];
};
