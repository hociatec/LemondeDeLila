import type { DeliveryRaceProgram } from '../../extensions/delivery-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { drawEvent } from './card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type DeliveryCard = {
  id: string | number;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
};

export function deliveryRaceRules(source: DeliveryRaceProgram) {
  const program = structuredClone(source);
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ ctx }) => ctx.match.lifecycle() !== 'finished',
      execute: ({ actor, ctx }) => playTurn(program, actor.id, ctx),
    }),
  };
}
function playTurn(
  program: DeliveryRaceProgram,
  playerId: number,
  ctx: Context,
): void {
  const client = ensureClient(program, playerId, ctx);
  if (!client) {
    ctx.turn.end();
    return;
  }
  const event = drawEvent<State, DeliveryCard>(ctx, {
    deckId: program.eventDeckId,
    playerId,
    recycle: true,
    discard: true,
  });
  if (event)
    ctx.events.message(`${program.eventNamespace}.event.drawn`, {
      eventId: event.id,
      blockedTileId: attribute(event, program.blockedPositionAttribute),
    });
  const start = ctx.movement.position(program.trackId, playerId);
  const value = ctx.dice.roll(program.diceId).total;
  const destination = ctx.movement.move(program.trackId, playerId, value);
  ctx.events.message(`${program.eventNamespace}.move.completed`, {
    playerId,
    value,
    tileId: destination + program.positionOffset,
  });
  const blocked = event
    ? attribute(event, program.blockedPositionAttribute) -
      program.positionOffset
    : null;
  if (blocked !== null && blocked > start && blocked <= destination) {
    ctx.events.message(`${program.eventNamespace}.route.blocked`, {
      playerId,
      eventId: event?.id,
      clientId: client.id,
    });
    ctx.movement.move(program.trackId, playerId, -destination);
    discardClient(program, playerId, client, ctx);
  } else if (
    destination ===
    attribute(client, program.destinationAttribute) - program.positionOffset
  ) {
    ctx.score.add(playerId, 1);
    ctx.events.message(`${program.eventNamespace}.client.delivered`, {
      playerId,
      clientId: client.id,
    });
    discardClient(program, playerId, client, ctx);
    if (ctx.score.get(playerId) >= program.targetScore)
      ctx.match.finish({ winners: [playerId], reason: program.finishReason });
    else ensureClient(program, playerId, ctx);
  }
  if (ctx.match.lifecycle() !== 'finished') ctx.turn.end();
}

function ensureClient(
  program: DeliveryRaceProgram,
  playerId: number,
  ctx: Context,
): DeliveryCard | null {
  const existing = ctx.cards.hand<DeliveryCard>(
    program.clientHandId,
    playerId,
  )[0];
  if (existing) return existing;
  const client = ctx.cards.drawToHand<DeliveryCard>(
    program.clientDeckId,
    program.clientHandId,
    playerId,
    { recycle: true },
  );
  if (!client) return null;
  ctx.events.message(`${program.eventNamespace}.client.picked-up`, {
    playerId,
    clientId: client.id,
    destinationId: attribute(client, program.destinationAttribute),
  });
  return client;
}

function discardClient(
  program: DeliveryRaceProgram,
  playerId: number,
  client: DeliveryCard,
  ctx: Context,
): void {
  ctx.cards.play(program.clientHandId, program.clientDeckId, playerId, client);
}

function attribute(card: DeliveryCard, name: string): number {
  const value = card.attributes[name];
  if (typeof value !== 'number')
    throw new Error(`Validated numeric card attribute missing: ${name}`);
  return value;
}
