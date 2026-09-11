import manifest from './manifest.json';
import { defineGameContent, gameInput } from '../../../engine/sdk/public-api';

export type MorpionPawn = {
  id: string;
  label: string;
  description: string;
  glyph: string;
};

const defaultPawns: readonly MorpionPawn[] = [
  {
    id: 'bourgeon-naissant',
    label: 'Un bourgeon naissant',
    description: 'Promesse de vie, il s’éveille en silence.',
    glyph: 'B',
  },
  {
    id: 'fleur-sauvage',
    label: 'Une fleur sauvage',
    description: 'Libre et lumineuse, elle parfume l’instant.',
    glyph: 'F',
  },
  {
    id: 'petale-fane',
    label: 'Un pétale fané',
    description: 'Fragile souvenir, il danse avec le vent.',
    glyph: 'P',
  },
  {
    id: 'pomme-de-pin',
    label: 'Une pomme de pin',
    description: 'Rugueuse et solide, elle garde ses secrets.',
    glyph: 'N',
  },
  {
    id: 'souche-ancienne',
    label: 'Une souche ancienne',
    description: 'Ancrée et patiente, elle veille sur la terre.',
    glyph: 'S',
  },
  {
    id: 'ecorce-parfumee',
    label: 'Une écorce parfumée',
    description: 'Chaleureuse et rare, elle raconte la forêt.',
    glyph: 'E',
  },
  {
    id: 'caillou-gris',
    label: 'Un caillou gris',
    description: 'Simple et stable, il marque le passage.',
    glyph: 'C',
  },
  {
    id: 'goutte-de-rosee',
    label: 'Une goutte de rosée',
    description: 'Claire et légère, elle brille au matin.',
    glyph: 'R',
  },
  {
    id: 'feuille-tendre',
    label: 'Une feuille tendre',
    description: 'Douce et vive, elle frissonne à l’air.',
    glyph: 'L',
  },
];

export const MORPION_GAME_CONTENT = defineGameContent(
  manifest.code,
  { pawns: defaultPawns },
  {
    schema: gameInput.object({
      pawns: gameInput.array(
        gameInput.object({
          id: gameInput.string({ min: 1, max: 128 }),
          label: gameInput.string({ min: 1, max: 200 }),
          description: gameInput.string({ max: 10000 }),
          glyph: gameInput.string({ min: 1, max: 8 }),
        }),
        { min: 2, max: 100 },
      ),
    }),
  },
);
export const MORPION_PAWNS: readonly MorpionPawn[] =
  MORPION_GAME_CONTENT.data.pawns;
