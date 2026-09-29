import { defineAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { GameConfigurationError } from '../contracts/game-domain.errors';
import type { GameContext } from '../definitions/game-author-context';
import { drawEvent } from './pattern-capabilities';

type AttributedCard = {
  id: string | number;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
};
export type DeliveryRaceOptions = {
  recipe: string;
  clientDeckId: string;
  clientHandId: string;
  eventDeckId: string;
  destinationAttribute: string;
  blockedPositionAttribute: string;
  positionOffset: number;
  targetScore: number;
  finishReason: string;
  eventNamespace: string;
};

type RaceWithDeliveryOptions = {
  trackId?: string;
  diceId?: string;
  delivery?: DeliveryRaceOptions;
};
type DeliveryOptions = DeliveryRaceOptions;

export function deliveryRaceAction<TState extends object>(
  options: RaceWithDeliveryOptions,
) {
  if (!options.delivery) return null;
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    available: ({ ctx }) => ctx.match.lifecycle() !== 'finished',
    execute: ({ actor, ctx }) => playDeliveryTurn(options, actor.id, ctx),
  });
}

function playDeliveryTurn<TState extends object>(
  options: RaceWithDeliveryOptions,
  playerId: number,
  ctx: GameContext<TState>,
): void {
  const delivery = options.delivery;
  if (!delivery) return;
  const client = ensureDeliveryClient(delivery, playerId, ctx);
  if (!client) return ctx.turn.end();
  const event = drawEvent<TState, AttributedCard>(ctx, {
    deckId: delivery.eventDeckId,
    playerId,
    recycle: true,
    discard: true,
  });
  if (event)
    ctx.events.message(`${delivery.eventNamespace}.event.drawn`, {
      eventId: event.id,
      blockedTileId: numericAttribute(event, delivery.blockedPositionAttribute),
    });
  const trackId = options.trackId ?? 'main';
  const start = ctx.movement.position(trackId, playerId);
  const value = ctx.dice.roll(options.diceId ?? 'main').total;
  const destination = ctx.movement.move(trackId, playerId, value);
  ctx.events.message(`${delivery.eventNamespace}.move.completed`, {
    playerId,
    value,
    tileId: destination + delivery.positionOffset,
  });
  const blocked = event
    ? numericAttribute(event, delivery.blockedPositionAttribute) -
      delivery.positionOffset
    : null;
  if (blocked !== null && blocked > start && blocked <= destination) {
    ctx.events.message(`${delivery.eventNamespace}.route.blocked`, {
      playerId,
      eventId: event?.id,
      clientId: client.id,
    });
    ctx.movement.move(trackId, playerId, -destination);
    discardDeliveryClient(delivery, playerId, client, ctx);
  } else if (
    destination ===
    numericAttribute(client, delivery.destinationAttribute) -
      delivery.positionOffset
  ) {
    ctx.score.add(playerId, 1);
    ctx.events.message(`${delivery.eventNamespace}.client.delivered`, {
      playerId,
      clientId: client.id,
    });
    discardDeliveryClient(delivery, playerId, client, ctx);
    if (ctx.score.get(playerId) >= delivery.targetScore)
      ctx.match.finish({
        winners: [playerId],
        reason: delivery.finishReason,
      });
    else ensureDeliveryClient(delivery, playerId, ctx);
  }
  if (ctx.match.lifecycle() !== 'finished') ctx.turn.end();
}

function ensureDeliveryClient<TState extends object>(
  delivery: DeliveryOptions,
  playerId: number,
  ctx: GameContext<TState>,
): AttributedCard | null {
  const existing = ctx.cards.hand<AttributedCard>(
    delivery.clientHandId,
    playerId,
  )[0];
  if (existing) return existing;
  const client = ctx.cards.drawToHand<AttributedCard>(
    delivery.clientDeckId,
    delivery.clientHandId,
    playerId,
    { recycle: true },
  );
  if (!client) return null;
  ctx.events.message(`${delivery.eventNamespace}.client.picked-up`, {
    playerId,
    clientId: client.id,
    destinationId: numericAttribute(client, delivery.destinationAttribute),
  });
  return client;
}

function discardDeliveryClient<TState extends object>(
  delivery: DeliveryOptions,
  playerId: number,
  client: AttributedCard,
  ctx: GameContext<TState>,
): void {
  ctx.cards.play(
    delivery.clientHandId,
    delivery.clientDeckId,
    playerId,
    client,
  );
}

function numericAttribute(card: AttributedCard, name: string): number {
  const value = card.attributes[name];
  if (typeof value !== 'number')
    throw new GameConfigurationError(
      `Validated numeric card attribute missing: ${name}`,
    );
  return value;
}
