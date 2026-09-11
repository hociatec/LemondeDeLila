import canonicalContent from './catalogue.json';
import manifest from './manifest.json';

import { galoponsSchema } from './content-schema';

import {
  cardContent,
  defineGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';

import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type GaloponsRegion = 'prairie' | 'riviere' | 'foret' | 'montagne';

export type GaloponsTileType =
  'start' | 'neutral' | 'card' | 'bonus' | 'skip' | 'finish';

export type GaloponsCard = {
  id: number;
  text: string;
  effects: readonly GameEffectInstruction[];
};

export const GALOPONS_GAME_CONTENT = defineGameContent(
  manifest.code,
  canonicalContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = galoponsSchema.parse(value);
        if (
          parsed.tiles.some((tile, index) => tile.n !== index + 1) ||
          parsed.tiles[0].type !== 'start' ||
          parsed.tiles.at(-1)?.type !== 'finish'
        )
          rejectContent('Piste Galopons invalide');
        return {
          cards: cardContent(parsed.cards),
          pawns: cardContent(parsed.pawns),
          tiles: parsed.tiles,
        };
      },
    },
  },
);

export const GALOPONS_CARDS = GALOPONS_GAME_CONTENT.data.cards;

export const GALOPONS_PAWNS = GALOPONS_GAME_CONTENT.data.pawns;

export const GALOPONS_TILES = GALOPONS_GAME_CONTENT.data.tiles;
