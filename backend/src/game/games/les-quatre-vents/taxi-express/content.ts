import {
  cardContent,
  rejectContent,
  trackContent,
} from '../../../engine/sdk/public-api';
import boardContent from './content/board.json';
import clientsContent from './content/clients.json';
import eventsContent from './content/events.json';
import rulesContent from './content/rules.json';

export type TaxiTile = { id: number; title: string };
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

export const TAXI_TILES = trackContent(
  boardContent.tiles.map((tile) => ({ ...tile })) satisfies TaxiTile[],
);
export const TAXI_CLIENTS = cardContent(
  clientsContent.cards.map((card) => ({ ...card })) satisfies TaxiClient[],
);
export const TAXI_EVENTS = cardContent(
  eventsContent.cards.map((card) => ({ ...card })) satisfies TaxiEvent[],
);
export const TAXI_TARGET_TRIPS = rulesContent.victory.target;

if (TAXI_TILES.length !== TAXI_EVENTS.length)
  rejectContent('Chaque rue Taxi doit posséder un événement');
if (
  TAXI_CLIENTS.some(
    (client) => !TAXI_TILES.some((tile) => tile.id === client.destinationId),
  )
)
  rejectContent('Une destination Taxi est absente du plateau');
