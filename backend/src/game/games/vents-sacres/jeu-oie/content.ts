import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import {
  gameInput,
  cardContent,
  defineGameContent,
  rejectContent,
  trackContent,
} from '../../../engine/sdk/public-api';

const gooseSchema = gameInput.object({
  pawns: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      label: gameInput.string({ min: 1, max: 200 }),
      feminine: gameInput.boolean(),
    }),
    { min: 6, max: 100 },
  ),
  tiles: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      label: gameInput.string({ min: 1, max: 2000 }),
      description: gameInput.optional(gameInput.string({ max: 10000 })),
      type: gameInput.enum([
        'start',
        'goose',
        'bridge',
        'inn',
        'magic-die',
        'labyrinth',
        'prison',
        'death',
        'well',
        'normal',
        'finish',
      ]),
      turnsToSkip: gameInput.optional(
        gameInput.number({ integer: true, min: 0, max: 1000 }),
      ),
      backTo: gameInput.optional(
        gameInput.number({ integer: true, min: 0, max: 63 }),
      ),
    }),
    { min: 64, max: 64 },
  ),
});
export const GOOSE_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    schema: {
      parse(value: unknown) {
        const parsed = gooseSchema.parse(value);
        if (
          parsed.tiles[1].type !== 'start' ||
          parsed.tiles[63].type !== 'finish'
        )
          rejectContent('Départ et arrivée du Jeu de l’Oie invalides');
        return {
          tiles: trackContent(parsed.tiles),
          pawns: cardContent(parsed.pawns),
        };
      },
    },
  },
);
export const GOOSE_TILES = GOOSE_GAME_CONTENT.data.tiles;
export const GOOSE_PAWNS = GOOSE_GAME_CONTENT.data.pawns;
