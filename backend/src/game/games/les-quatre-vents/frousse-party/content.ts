import canonicalContent from './catalogue.json';
import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  cardContent,
  effectContentSchema,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type FrousseCategory = 'trap' | 'prank' | 'ghost' | 'bonus';

export type FrousseBlock =
  | { kind: 'one-of'; allowed: number[] }
  | { kind: 'minimum'; minimum: number }
  | { kind: 'even' };

export type FrousseCard = {
  id: number;
  localNumber: number;
  category: FrousseCategory;
  text: string;
  effects: readonly GameEffectInstruction[];
};

const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
const frousseSchema = gameInput.object({
  tiles: gameInput.array(
    gameInput.object({
      n: gameInput.number({ integer: true, min: 1 }),
      title: textSchema,
      label: textSchema,
      description: textSchema,
      type: gameInput.enum(['neutral', 'card', 'finish']),
    }),
    { min: 2, max: 1000 },
  ),
  pawns: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: textSchema,
      description: textSchema,
    }),
    { min: 6, max: 100 },
  ),
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.number({ integer: true, min: 1 }),
      localNumber: gameInput.number({ integer: true, min: 1 }),
      category: gameInput.enum(['trap', 'prank', 'ghost', 'bonus']),
      text: textSchema,
      effects: effectContentSchema({
        effects: [
          'frousse.move',
          'frousse.goto',
          'frousse.swap',
          'frousse.move-others',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
});
export const FROUSSE_GAME_CONTENT = defineGameContent(
  manifest.code,
  canonicalContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = frousseSchema.parse(value);
        if (
          parsed.tiles.some((tile, index) => tile.n !== index + 1) ||
          parsed.tiles.at(-1)?.type !== 'finish'
        )
          rejectContent('Piste Frousse invalide');
        return {
          tiles: parsed.tiles,
          pawns: cardContent(parsed.pawns),
          cards: cardContent(parsed.cards),
        };
      },
    },
  },
);
export const FROUSSE_TILES = FROUSSE_GAME_CONTENT.data.tiles;
export const FROUSSE_PAWNS = FROUSSE_GAME_CONTENT.data.pawns;
export const FROUSSE_CARDS = FROUSSE_GAME_CONTENT.data.cards;
