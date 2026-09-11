import {
  cardContent,
  defineGameContent,
  gameInput,
  rejectContent,
  trackContent,
} from '../../../engine/sdk/public-api';
import boardContent from './content/board.json';
import clientsContent from './content/clients.json';
import eventsContent from './content/events.json';
import rulesContent from './content/rules.json';
import manifest from './manifest.json';
export type TaxiClient = {
  id: number;
  clientName: string;
  destinationId: number;
  route: string;
};
export type TaxiEvent = {
  id: number;
  title: string;
  description: string;
  blockedTileId: number;
};

export const TAXI_TARGET_TRIPS = rulesContent.victory.target;
const idSchema = gameInput.number({ integer: true, min: 1 });
const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
const taxiSchema = gameInput.object({
  tiles: gameInput.array(
    gameInput.object({ id: idSchema, title: textSchema }),
    { min: 2, max: 1000 },
  ),
  clients: gameInput.array(
    gameInput.object({
      id: idSchema,
      clientName: textSchema,
      destinationId: idSchema,
      route: textSchema,
    }),
    { min: 1, max: 10000 },
  ),
  events: gameInput.array(
    gameInput.object({
      id: idSchema,
      title: textSchema,
      description: textSchema,
      blockedTileId: idSchema,
    }),
    { min: 1, max: 1000 },
  ),
});
export const TAXI_GAME_CONTENT = defineGameContent(
  manifest.code,
  {
    clients: clientsContent.cards,
    events: eventsContent.cards,
    tiles: boardContent.tiles,
  },
  {
    schema: {
      parse(value: unknown) {
        const parsed = taxiSchema.parse(value);
        const tileIds = new Set(parsed.tiles.map((tile) => tile.id));
        if (
          parsed.tiles.length !== parsed.events.length ||
          new Set(parsed.events.map((event) => event.blockedTileId)).size !==
            tileIds.size ||
          parsed.events.some((event) => !tileIds.has(event.blockedTileId))
        )
          rejectContent('Chaque rue Taxi doit posséder un événement');
        if (parsed.clients.some((client) => !tileIds.has(client.destinationId)))
          rejectContent('Une destination Taxi est absente du plateau');
        return {
          clients: cardContent(parsed.clients),
          events: cardContent(parsed.events),
          tiles: trackContent(parsed.tiles),
        };
      },
    },
  },
);
export const TAXI_TILES = TAXI_GAME_CONTENT.data.tiles;
export const TAXI_CLIENTS = TAXI_GAME_CONTENT.data.clients;
export const TAXI_EVENTS = TAXI_GAME_CONTENT.data.events;
