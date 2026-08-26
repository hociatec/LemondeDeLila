import {
  freezeGameContent,
  rejectContent,
} from '../../../core/application/public-api';
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

export const TAXI_TILES: TaxiTile[] = boardContent.tiles.map((tile) => ({
  ...tile,
}));
export const TAXI_CLIENTS: TaxiClient[] = clientsContent.cards.map((card) => ({
  ...card,
}));
export const TAXI_EVENTS: TaxiEvent[] = eventsContent.cards.map((card) => ({
  ...card,
}));
export const TAXI_TARGET_TRIPS = rulesContent.victory.target;

if (TAXI_TILES.length !== TAXI_EVENTS.length)
  rejectContent('Chaque rue Taxi doit posséder un événement');
if (
  TAXI_CLIENTS.some(
    (client) => !TAXI_TILES.some((tile) => tile.id === client.destinationId),
  )
)
  rejectContent('Une destination Taxi est absente du plateau');

freezeGameContent(TAXI_TILES);
freezeGameContent(TAXI_CLIENTS);
freezeGameContent(TAXI_EVENTS);
