import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  cardContent,
  effectContentSchema,
  rejectContent,
  gameEffects,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type BandeABananeCardType = 'monkey' | 'action' | 'trap' | 'joker';

import type { BandeABananeMonkeySpecies } from './types';
export type { BandeABananeMonkeySpecies } from './types';

export type BandeABananeActionType =
  'vol-de-banane' | 'cris-de-la-jungle' | 'grimpeur-fou';

export type BandeABananeTrapType = 'piege-a-noix-de-coco' | 'tigre-rodeur';

export interface BandeABananeCardDefinition {
  id: string;
  name: string;
  type: BandeABananeCardType;
  species?: BandeABananeMonkeySpecies;
  action?: BandeABananeActionType;
  trap?: BandeABananeTrapType;
  effects: readonly GameEffectInstruction[];
}

const createCopies = (
  prefix: string,
  count: number,
  details: Omit<BandeABananeCardDefinition, 'id'>,
): BandeABananeCardDefinition[] =>
  Array.from({ length: count }, (_, index): BandeABananeCardDefinition => ({
    id: `${prefix}-${index + 1}`,
    ...details,
  }));

const deck: BandeABananeCardDefinition[] = [
  ...createCopies('monkey-capucin', 6, {
    type: 'monkey',
    name: 'Capucin malicieux',
    species: 'capucin',
    effects: [],
  }),
  ...createCopies('monkey-mandrill', 6, {
    type: 'monkey',
    name: 'Mandrill paradeur',
    species: 'mandrill',
    effects: [],
  }),
  ...createCopies('monkey-gibbon', 6, {
    type: 'monkey',
    name: 'Gibbon bondissant',
    species: 'gibbon',
    effects: [],
  }),
  ...createCopies('monkey-babouin', 6, {
    type: 'monkey',
    name: 'Babouin observateur',
    species: 'babouin',
    effects: [],
  }),
  ...createCopies('monkey-macaque', 6, {
    type: 'monkey',
    name: 'Macaque zen',
    species: 'macaque',
    effects: [],
  }),
  ...createCopies('action-vol-de-banane', 5, {
    type: 'action',
    name: 'Vol de banane',
    action: 'vol-de-banane',
    effects: [
      gameEffects.stealCard({
        handId: 'players',
        from: gameEffects.target.chosenOpponent('banana.steal'),
      }),
    ],
  }),
  ...createCopies('action-cris-de-la-jungle', 5, {
    type: 'action',
    name: 'Cris de la jungle',
    action: 'cris-de-la-jungle',
    effects: [
      gameEffects.custom(
        'banana.exchange-random',
        {},
        gameEffects.target.chosenOpponent('banana.exchange'),
      ),
    ],
  }),
  ...createCopies('action-grimpeur-fou', 5, {
    type: 'action',
    name: 'Grimpeur fou',
    action: 'grimpeur-fou',
    effects: [
      gameEffects.drawCards({
        deckId: 'banana',
        handId: 'players',
        count: 2,
        recycle: true,
      }),
    ],
  }),
  ...createCopies('trap-piege-a-noix-de-coco', 5, {
    type: 'trap',
    name: 'Piège à noix de coco',
    trap: 'piege-a-noix-de-coco',
    effects: [gameEffects.skipTurn(1)],
  }),
  ...createCopies('trap-tigre-rodeur', 5, {
    type: 'trap',
    name: 'Tigre rôdeur',
    trap: 'tigre-rodeur',
    effects: [
      gameEffects.discardCards({
        deckId: 'banana',
        handId: 'players',
        count: 1,
      }),
    ],
  }),
  ...createCopies('joker-singe-deguise', 5, {
    type: 'joker',
    name: 'Singe déguisé',
    effects: [],
  }),
];

const deckSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),

      type: gameInput.enum(['monkey', 'action', 'trap', 'joker']),
      species: gameInput.optional(
        gameInput.enum(['capucin', 'mandrill', 'gibbon', 'babouin', 'macaque']),
      ),
      action: gameInput.optional(
        gameInput.enum(['vol-de-banane', 'cris-de-la-jungle', 'grimpeur-fou']),
      ),
      trap: gameInput.optional(
        gameInput.enum(['piege-a-noix-de-coco', 'tigre-rodeur']),
      ),
      effects: effectContentSchema({
        decks: ['banana'],
        hands: ['players'],
        effects: ['banana.exchange-random'],
      }),
    }),
    { min: 1, max: 10000 },
  ),
});
export const BANDE_A_BANANE_GAME_CONTENT = defineGameContent(
  manifest.code,
  { cards: deck },
  {
    schema: {
      parse(value: unknown) {
        const parsed = deckSchema.parse(value);

        for (const card of parsed.cards) {
          if (card.type === 'monkey' && !card.species)
            rejectContent('Espèce requise');
          if (card.type === 'action' && !card.action)
            rejectContent('Action requise');
          if (card.type === 'trap' && !card.trap) rejectContent('Piège requis');
        }
        return { cards: cardContent(parsed.cards) };
      },
    },
  },
);
export const BANDE_A_BANANE_DECK = BANDE_A_BANANE_GAME_CONTENT.data.cards;
export const BANDE_A_BANANE_CARD_BY_ID: Readonly<
  Record<string, BandeABananeCardDefinition>
> = Object.freeze(
  Object.fromEntries(BANDE_A_BANANE_DECK.map((card) => [card.id, card])),
);
