import {
  defineGameContent,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';
import embeddedCatalogue from './catalogue.json';
import manifest from './manifest.json';

const integer = gameInput.number({ integer: true, coerce: false });
const text = gameInput.string({ trim: false });
const tileSchema = gameInput.object(
  {
    n: integer,
    title: text,
    description: text,
    type: gameInput.enum(['card', 'finish']),
  },
  { unknownKeys: 'reject' },
);
const cardSchema = gameInput.object(
  { id: integer, title: text, description: text, zoneId: integer },
  { unknownKeys: 'reject' },
);
const zoneSchema = gameInput.object(
  { id: integer, title: text, cards: gameInput.array(cardSchema) },
  { unknownKeys: 'reject' },
);
const catalogueSchema = gameInput.object(
  {
    tiles: gameInput.array(tileSchema, { min: 1 }),
    zones: gameInput.array(zoneSchema),
  },
  { unknownKeys: 'reject' },
);

export const MON_VILLAGE_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    formatVersion: 1,
    schema: {
      parse(value: unknown) {
        const content = catalogueSchema.parse(value);
        if (
          new Set(content.zones.map((zone) => zone.id)).size !==
          content.zones.length
        )
          rejectContent('Duplicate zones');
        for (const zone of content.zones) {
          if (zone.cards.some((card) => card.zoneId !== zone.id))
            rejectContent('Invalid zone reference');
        }
        return content;
      },
    },
  },
);
export const VILLAGE_TILES = MON_VILLAGE_CONTENT.data.tiles;
export const VILLAGE_ZONES = MON_VILLAGE_CONTENT.data.zones;
