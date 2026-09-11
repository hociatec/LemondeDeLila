import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';

const defaults = {
  trackLength: 56,
  homeLength: 6,
  pawnsPerPlayer: 4,
  pawnNames: ['Aube', 'Brise', 'Comète', 'Dune'],
} as const;

const schema = gameInput.object({
  trackLength: gameInput.number({ integer: true, min: 8, max: 1000 }),
  homeLength: gameInput.number({ integer: true, min: 1, max: 100 }),
  pawnsPerPlayer: gameInput.number({ integer: true, min: 1, max: 8 }),
  pawnNames: gameInput.array(gameInput.string({ min: 1, max: 200 }), {
    min: 1,
    max: 8,
  }),
});
export const ODYSSEE_GAME_CONTENT = defineGameContent(manifest.code, defaults, {
  schema: {
    parse(value: unknown) {
      const content = schema.parse(value);
      if (content.pawnNames.length !== content.pawnsPerPlayer)
        rejectContent('Chaque pion doit avoir un nom');
      return content;
    },
  },
});
export const ODYSSEE_CONTENT = ODYSSEE_GAME_CONTENT.data;
