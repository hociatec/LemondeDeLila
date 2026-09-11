import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  cardContent,
  effectContentSchema,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import data from './content-data.json';

export type LaGrandeMineCategory =
  'tresor' | 'objet' | 'event' | 'monster' | 'collapse';

export interface LaGrandeMineCard {
  id: string;
  name: string;
  category: LaGrandeMineCategory;
  description: string;
  points?: number | null;
  effects: readonly GameEffectInstruction[];
}

const mineSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),
      category: gameInput.enum([
        'tresor',
        'objet',
        'event',
        'monster',
        'collapse',
      ]),
      description: gameInput.string({ max: 4000 }),
      points: gameInput.optional(
        gameInput.union([
          gameInput.number({ integer: true, min: -1000000, max: 1000000 }),
          gameInput.literal(null),
        ]),
      ),
      effects: effectContentSchema({
        decks: ['mine'],
        hands: ['players'],
        effects: [
          'mine.draw-passive',
          'mine.recover-discard',
          'mine.remove-treasure-all',
          'mine.trim-hand',
          'mine.double-next-player',
          'mine.remove-treasure',
          'mine.finish',
          'mine.remove-domain-all',
          'mine.remove-domain',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
});
export const LA_GRANDE_MINE_GAME_CONTENT = defineGameContent(
  manifest.code,
  data,
  {
    schema: {
      parse(value: unknown) {
        return { cards: cardContent(mineSchema.parse(value).cards) };
      },
    },
  },
);
export const LA_GRANDE_MINE_CARDS = LA_GRANDE_MINE_GAME_CONTENT.data.cards;
export const LA_GRANDE_MINE_CARD_BY_ID = Object.freeze(
  Object.fromEntries(LA_GRANDE_MINE_CARDS.map((card) => [card.id, card])),
);
