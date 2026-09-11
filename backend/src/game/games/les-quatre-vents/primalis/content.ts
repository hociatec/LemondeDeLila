import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import { isRecord } from '../../../engine/sdk/public-api';
import {
  defineGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';

export type PrimalisTile = {
  n: number;
  title: string;
  description: string;
  type: 'comet';
};

export const PRIMALIS_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  { schema: { parse: parseContent } },
);
export const PRIMALIS_TILES = PRIMALIS_GAME_CONTENT.data.tiles;

function parseContent(parsed: unknown): { tiles: PrimalisTile[] } {
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.tiles) ||
    parsed.tiles.length === 0 ||
    !parsed.tiles.every(isPrimalisTile)
  ) {
    rejectContent('Plateau Primalis invalide');
  }
  return { tiles: parsed.tiles };
}

function isPrimalisTile(value: unknown): value is PrimalisTile {
  return (
    isRecord(value) &&
    typeof value.n === 'number' &&
    Number.isSafeInteger(value.n) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    value.type === 'comet'
  );
}
