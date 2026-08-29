import {
  defineAction,
  drawEvent,
  gameInput,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import {
  TAXI_TILES,
  TAXI_TARGET_TRIPS,
  type TaxiClient,
  type TaxiEvent,
} from './content';
import type { NoGameState as TaxiState } from '../../../engine/sdk/public-api';

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
    const event = drawEvent<TaxiState, TaxiEvent>(ctx, {
      deckId: 'events',
      playerId: actor.id,
      recycle: true,
      discard: true,
    });
    if (event) {
      ctx.events.message('taxi.event.drawn', {
        eventId: event.id,
        blockedTileId: event.blockedTileId,
      });
    }
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

function ensureClient(playerId: number, ctx: RuleContext): TaxiClient | null {
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
