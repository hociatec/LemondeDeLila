import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';
import {
  defineGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { parseSacContent } from './content-schema';
import type { SacVariant, SacVariantId } from './content-types';
export type {
  SacVariantId,
  SacTileType,
  SacTile,
  SacGroup,
  SacStationRules,
  SacUtility,
  SacRules,
  SacVariant,
} from './content-types';
export type { SacCard, SacMovement } from './card-content';

export const SAC_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    formatVersion: 2,
    schema: { parse: parseSacContent },
  },
);
export const SAC_VARIANTS = SAC_GAME_CONTENT.data.variants;

export function sacVariant(id: SacVariantId): SacVariant {
  const selected = SAC_VARIANTS.find((candidate) => candidate.id === id);
  if (!selected) rejectContent(`Variante Sac à Malices inconnue: ${id}`);
  return selected;
}
