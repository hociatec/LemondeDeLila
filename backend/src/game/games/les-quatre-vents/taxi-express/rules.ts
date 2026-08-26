import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  TAXI_TILES,
  TAXI_TARGET_TRIPS,
  type TaxiClient,
  type TaxiEvent,
} from './content';
import type { TaxiState } from './state';

type RuleContext = GameRuleContext<TaxiState>;
const TRACK = 'city';

export const roll = defineAction<TaxiState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Prend un client, révèle un obstacle, lance le dé et résout le trajet.',
  available: ({ state }) => state.winnerId == null,
  execute: ({ state, actor, ctx }) => {
    const client = ensureClient(state, actor.id, ctx);
    if (!client) {
      ctx.turn.end();
      return;
    }
    const event = drawEvent(state, ctx);
    const start = ctx.movement.position(TRACK, actor.id);
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    const destination = Math.min(TAXI_TILES.length - 1, start + value);
    ctx.movement.move(TRACK, actor.id, destination - start);
    ctx.history.add(
      `${actor.username} obtient ${value} et atteint « ${TAXI_TILES[destination].title} ».`,
    );
    if (event && crosses(start, destination, event.blockedTileId - 1)) {
      ctx.history.add(
        `${event.title} bloque la route : le client descend et le taxi revient à la station.`,
      );
      ctx.movement.move(TRACK, actor.id, -destination);
      discardClient(state, actor.id, client, ctx);
    } else if (destination === client.destinationId - 1) {
      state.completedTrips[actor.id] += 1;
      ctx.history.add(`${client.clientName} est arrivé à destination.`);
      discardClient(state, actor.id, client, ctx);
      if (state.completedTrips[actor.id] >= TAXI_TARGET_TRIPS)
        state.winnerId = actor.id;
      else ensureClient(state, actor.id, ctx);
    }
    if (state.winnerId == null) ctx.turn.end();
  },
});

export const TAXI_ACTIONS = { roll };

function ensureClient(
  state: TaxiState,
  playerId: number,
  ctx: RuleContext,
): TaxiClient | null {
  const existing = state.activeClients[playerId];
  if (existing) return existing;
  const client = ctx.cards.drawOrRecycle<TaxiClient>('clients');
  if (!client) return null;
  state.activeClients[playerId] = client;
  ctx.history.add(
    `Nouveau client : ${client.clientName}, destination « ${tileTitle(client.destinationId)} ».`,
  );
  return client;
}

function drawEvent(state: TaxiState, ctx: RuleContext): TaxiEvent | null {
  const event = ctx.cards.drawOrRecycle<TaxiEvent>('events');
  if (!event) return null;
  ctx.cards.discard('events', event);
  state.lastEvent = event;
  ctx.history.add(
    `Événement : ${event.title}, « ${tileTitle(event.blockedTileId)} » est bloquée.`,
  );
  return event;
}

function discardClient(
  state: TaxiState,
  playerId: number,
  client: TaxiClient,
  ctx: RuleContext,
): void {
  ctx.cards.discard('clients', client);
  state.activeClients[playerId] = null;
}

function crosses(start: number, destination: number, blocked: number): boolean {
  return blocked > start && blocked <= destination;
}

function tileTitle(tileId: number): string {
  return (
    TAXI_TILES.find((tile) => tile.id === tileId)?.title ?? `Case ${tileId}`
  );
}
