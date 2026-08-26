import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import {
  TAXI_CLIENTS,
  TAXI_EVENTS,
  TAXI_TILES,
  TAXI_TARGET_TRIPS,
  type TaxiClient,
  type TaxiEvent,
} from './content';
import type { TaxiState } from './state';

type RuleContext = GameContext<TaxiState>;
const TRACK = 'city';

export const roll = defineAction<TaxiState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Prend un client, révèle un obstacle, lance le dé et résout le trajet.',
  available: ({ ctx }) => ctx.match.lifecycle() !== 'finished',
  execute: ({ actor, ctx }) => {
    const client = ensureClient(actor.id, ctx);
    if (!client) {
      ctx.turn.end();
      return;
    }
    const event = drawEvent(ctx);
    const start = ctx.movement.position(TRACK, actor.id);
    const value = ctx.dice.roll('main').total;
    const destination = Math.min(TAXI_TILES.length - 1, start + value);
    ctx.movement.move(TRACK, actor.id, destination - start);
    ctx.events.message('taxi.move.completed', {
      playerId: actor.id,
      value,
      tileId: TAXI_TILES[destination].id,
    });
    if (event && crosses(start, destination, event.blockedTileId - 1)) {
      ctx.events.message('taxi.route.blocked', {
        playerId: actor.id,
        eventId: event.id,
        clientId: client.id,
      });
      ctx.movement.move(TRACK, actor.id, -destination);
      discardClient(actor.id, client, ctx);
    } else if (destination === client.destinationId - 1) {
      const completedTrips = ctx.score.add(actor.id, 1);
      ctx.events.message('taxi.client.delivered', {
        playerId: actor.id,
        clientId: client.id,
      });
      discardClient(actor.id, client, ctx);
      if (completedTrips >= TAXI_TARGET_TRIPS) {
        ctx.match.finish({ winners: [actor.id], reason: 'five-trips' });
      } else ensureClient(actor.id, ctx);
    }
    if (ctx.match.lifecycle() !== 'finished') ctx.turn.end();
  },
});

export const TAXI_ACTIONS = { roll };

function ensureClient(
  playerId: number,
  ctx: RuleContext,
): TaxiClient | null {
  const existing = ctx.cards.hand<TaxiClient>('taxi-clients', playerId)[0];
  if (existing) return existing;
  const client = ctx.cards.drawToHand<TaxiClient>(
    'clients',
    'taxi-clients',
    playerId,
    { recycle: true },
  );
  if (!client) return null;
  ctx.events.message('taxi.client.picked-up', {
    playerId,
    clientId: client.id,
    destinationId: client.destinationId,
  });
  return client;
}

function drawEvent(ctx: RuleContext): TaxiEvent | null {
  const event = ctx.cards.drawOrRecycle<TaxiEvent>('events');
  if (!event) return null;
  ctx.cards.discard('events', event);
  ctx.events.message('taxi.event.drawn', {
    eventId: event.id,
    blockedTileId: event.blockedTileId,
  });
  return event;
}

function discardClient(
  playerId: number,
  client: TaxiClient,
  ctx: RuleContext,
): void {
  ctx.cards.play('taxi-clients', 'clients', playerId, client);
}

function crosses(start: number, destination: number, blocked: number): boolean {
  return blocked > start && blocked <= destination;
}

function tileTitle(tileId: number): string {
  return (
    TAXI_TILES.find((tile) => tile.id === tileId)?.title ?? `Case ${tileId}`
  );
}
