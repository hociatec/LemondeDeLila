export type BalloonTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'folie'
  | 'piege'
  | 'glissade'
  | 'tornade'
  | 'chaton'
  | 'finish';
import canonicalContent from './catalogue.json';
import manifest from './manifest.json';

import { balloonsSchema } from './content-schema';

import {
  cardContent,
  defineGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';

import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type BalloonCard = {
  id: number;
  text: string;
  effects: readonly GameEffectInstruction[];
  retreatScore: number;
};

export const BALLOONS_GAME_CONTENT = defineGameContent(
  manifest.code,
  canonicalContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = balloonsSchema.parse(value);
        if (
          parsed.tiles[0].type !== 'start' ||
          parsed.tiles.at(-1)?.type !== 'finish'
        )
          rejectContent('Piste des ballons invalide');
        return {
          cards: cardContent(parsed.cards),
          pawns: cardContent(parsed.pawns),
          tiles: parsed.tiles,
        };
      },
    },
  },
);

export const A_FOND_LES_BALLONS_CARDS = BALLOONS_GAME_CONTENT.data.cards;

export const A_FOND_LES_BALLONS_PAWNS = BALLOONS_GAME_CONTENT.data.pawns;

export const A_FOND_LES_BALLONS_TILES = BALLOONS_GAME_CONTENT.data.tiles;
