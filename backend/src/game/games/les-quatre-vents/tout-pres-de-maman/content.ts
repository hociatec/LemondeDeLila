import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import {
  effectContentSchema,
  defineGameContent,
  gameInput,
} from '../../../engine/sdk/public-api';

const tileSchema = gameInput.object(
  {
    id: gameInput.number({ integer: true, coerce: false }),
    title: gameInput.string({ trim: false }),
    description: gameInput.optional(gameInput.string({ trim: false })),
    type: gameInput.enum([
      'start',
      'neutral',
      'token',
      'card',
      'bonds',
      'slide',
      'storm',
      'nest',
      'meeting',
      'finish',
    ]),
  },
  { unknownKeys: 'reject' },
);

const cardSchema = gameInput.object(
  {
    id: gameInput.number({ integer: true, coerce: false }),
    text: gameInput.string({ trim: false }),
    effects: effectContentSchema({
      effects: [
        'maman.move',
        'maman.move-to-type',
        'maman.transfer-token',
        'maman.roll-move',
        'maman.roll-threshold-move',
        'maman.share-advance',
      ],
    }),
  },
  { unknownKeys: 'reject' },
);

const catalogueSchema = gameInput.object(
  {
    tiles: gameInput.array(tileSchema),
    cards: gameInput.array(cardSchema),
  },
  { unknownKeys: 'reject' },
);

export const MAMAN_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    formatVersion: 1,
    snapshotMigrations: [
      {
        fromVersion: 'tout-pres-de-maman@content:f766ed9f',
        toVersion: 'tout-pres-de-maman@content:6c60e669',
      },
    ],
    schema: catalogueSchema,
  },
);
export const MAMAN_CONTENT = MAMAN_GAME_CONTENT.data;
