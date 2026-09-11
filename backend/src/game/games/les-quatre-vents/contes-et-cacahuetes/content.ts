import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import {
  cardContent,
  defineGameContent,
  effectContentSchema,
  gameInput,
  rejectContent,
  trackContent,
} from '../../../engine/sdk/public-api';
import rawContent from './content-data.json';
import manifest from './manifest.json';

export type ContesTileType =
  'start' | 'conte' | 'bonus' | 'malus' | 'surprise' | 'finish';

export type ContesCardType = 'bonus' | 'malus' | 'surprise' | 'conte';

export type ContesCard = {
  id: number;
  type: ContesCardType;
  title: string;
  text: string;
  effects: readonly GameEffectInstruction[];
};

const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
const idSchema = gameInput.string({ min: 1, max: 128 });
const deckSchema = gameInput.array(
  gameInput.object({
    id: gameInput.number({ integer: true, min: 1 }),
    type: gameInput.enum(['bonus', 'malus', 'surprise', 'conte']),
    title: textSchema,
    text: textSchema,
    effects: effectContentSchema({
      tracks: ['story-road'],
      effects: [
        'contes.move',
        'contes.draw',
        'contes.schedule-target',
        'contes.roll-move',
        'contes.queue-draws',
        'contes.extend-status',
        'contes.force-one-others',
        'contes.abundance',
        'contes.swap-closest',
        'contes.block',
        'contes.bonus-gift',
        'contes.skip-if-low-roll',
        'contes.previous-malus',
        'contes.queue-random-draws',
        'contes.laughter',
        'contes.conte',
        'contes.option',
      ],
    }),
  }),
  { min: 1, max: 10000 },
);
const contesSchema = gameInput.object({
  tiles: gameInput.array(
    gameInput.object({
      id: idSchema,
      type: gameInput.enum([
        'start',
        'conte',
        'bonus',
        'malus',
        'surprise',
        'finish',
      ]),
      label: textSchema,
      description: textSchema,
    }),
    { min: 2, max: 1000 },
  ),
  pawns: gameInput.array(
    gameInput.object({
      id: idSchema,
      label: textSchema,
      description: textSchema,
    }),
    { min: 6, max: 100 },
  ),
  decks: gameInput.object({
    bonus: deckSchema,
    malus: deckSchema,
    surprise: deckSchema,
    conte: deckSchema,
  }),
});
export const CONTES_GAME_CONTENT = defineGameContent(
  manifest.code,
  rawContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = contesSchema.parse(value);
        for (const [type, cards] of Object.entries(parsed.decks)) {
          if (cards.some((card) => card.type !== type))
            rejectContent('Type de carte différent de la pioche');
        }
        return {
          tiles: trackContent(parsed.tiles),
          pawns: cardContent(parsed.pawns),
          decks: {
            bonus: cardContent(parsed.decks.bonus),
            malus: cardContent(parsed.decks.malus),
            surprise: cardContent(parsed.decks.surprise),
            conte: cardContent(parsed.decks.conte),
          },
        };
      },
    },
  },
);
export const CONTES_TILES = CONTES_GAME_CONTENT.data.tiles;
export const CONTES_PAWNS = CONTES_GAME_CONTENT.data.pawns;
export const CONTES_DECKS = CONTES_GAME_CONTENT.data.decks;

export const CONTES_CONTENT_COUNTS = {
  tiles: CONTES_TILES.length,
  cards: Object.values(CONTES_DECKS).reduce(
    (total, deck) => total + deck.length,
    0,
  ),
};
