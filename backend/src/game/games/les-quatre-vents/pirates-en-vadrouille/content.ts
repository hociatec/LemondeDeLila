import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';
import {
  defineGameContent,
  effectContentSchema,
  gameInput,
} from '../../../engine/sdk/public-api';

const tileSchema = gameInput.object(
  {
    n: gameInput.number({ integer: true, coerce: false }),
    title: gameInput.string({ trim: false }),
    description: gameInput.string({ trim: false }),
    type: gameInput.enum([
      'start',
      'neutral',
      'bonus',
      'treasure',
      'obstacle',
      'gold',
      'finish',
    ]),
  },
  { unknownKeys: 'reject' },
);
const cardSchema = gameInput.object(
  {
    id: gameInput.number({ integer: true, coerce: false }),
    title: gameInput.string({ trim: false }),
    description: gameInput.string({ trim: false }),
    effects: effectContentSchema({
      tracks: ['island'],
      effects: ['pirates.steal-treasure'],
    }),
  },
  { unknownKeys: 'reject' },
);
const catalogueSchema = gameInput.object(
  {
    tiles: gameInput.array(tileSchema),
    treasure: gameInput.array(cardSchema),
    obstacle: gameInput.array(cardSchema),
    bonus: gameInput.array(cardSchema),
  },
  { unknownKeys: 'reject' },
);

export const PIRATES_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    formatVersion: 1,
    snapshotMigrations: [
      {
        fromVersion: 'pirates-en-vadrouille@content:ddf4bb7f',
        toVersion: 'pirates-en-vadrouille@content:3609939f',
      },
    ],
    schema: catalogueSchema,
  },
);
export const PIRATES_CONTENT = PIRATES_GAME_CONTENT.data;
