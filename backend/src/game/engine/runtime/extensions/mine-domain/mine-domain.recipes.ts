import type { MineDomainProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { gameEffects } from '../../effects/effects-kit';
import { defineEffect } from '../../effects/effects-core';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = MineDomainProgram['cards'][number];

export function mineDomainRules(source: MineDomainProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const enumerate = (playerId: number, ctx: Context) =>
    ctx.cards
      .hand<string>(program.handId, playerId)
      .filter((cardId) => cards.has(cardId))
      .map((cardId) => ({ cardId }));
  return {
    play: defineAction<State, { cardId: string }>({
      input: gameInput.object({ cardId: gameInput.cardId() }),
      validate: ({ actor, input, ctx }) =>
        enumerate(actor.id, ctx).some(({ cardId }) => cardId === input.cardId),
      enumerate: ({ actor, ctx }) => enumerate(actor.id, ctx),
      execute: ({ actor, input, ctx }) => {
        const card = cards.get(input.cardId)!;
        ctx.cards.take(program.handId, actor.id, input.cardId);
        if (isCollectible(card)) {
          ctx.inventory.add(program.inventoryId, actor.id, card.id);
          syncScore(program, cards, actor.id, ctx);
        } else {
          ctx.cards.discard(program.deckId, card.id);
          resolveImmediate(program, card, ctx);
        }
        trimHand(program, actor.id, ctx);
        if (isCollectible(card)) ctx.turn.complete();
        else ctx.effects.schedule(gameEffects.completeTurn());
      },
      documentation: 'Pose une carte de domaine ou résout son effet immédiat.',
    }),
    pass: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        trimHand(program, actor.id, ctx);
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.complete();
      },
    }),
    lifecycle: {
      beforeTurn: ({ ctx }: { ctx: Context }) =>
        drawAtTurnStart(program, cards, ctx),
    },
    effects: mineEffects(program, cards),
    enumerate,
  };
}
function mineEffects(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
) {
  return {
    'mine.remove-domain': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (target != null) removeRandomDomainCard(program, cards, target, ctx);
      },
    }),
    'mine.remove-domain-all': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ ctx }) => {
        for (const player of ctx.players.all())
          removeRandomDomainCard(program, cards, player.id, ctx);
      },
    }),
    'mine.remove-treasure-all': defineEffect<State, { count: number }>({
      input: gameInput.object({
        count: gameInput.number({ integer: true, min: 0 }),
      }),
      apply: ({ data, ctx }) => {
        for (const player of ctx.players.all())
          for (let index = 0; index < data.count; index += 1)
            removeRandomTreasure(program, cards, player.id, ctx);
      },
    }),
    'mine.recover-discard': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          recoverDiscard(program, cards, actorPlayerId, ctx);
      },
    }),
    'mine.draw-passive': defineEffect<State, { count: number }>({
      input: gameInput.object({
        count: gameInput.number({ integer: true, min: 0 }),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const target of targetPlayerIds)
          for (let index = 0; index < data.count; index += 1)
            drawPassive(program, cards, target, ctx);
      },
    }),
    'mine.trim-hand': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null) trimHand(program, actorPlayerId, ctx);
      },
    }),
    'mine.double-next-player': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId == null) return;
        const next = ctx.players.after(actorPlayerId)?.id;
        if (next == null) return;
        ctx.turn.to(next);
        ctx.turn.extra();
        ctx.turn.to(actorPlayerId);
      },
    }),
    'mine.remove-treasure': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          removeRandomTreasure(program, cards, actorPlayerId, ctx);
      },
    }),
    'mine.finish': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          ctx.events.message(
            `${program.eventNamespace}.final-collapse.triggered`,
            {
              playerId: actorPlayerId,
            },
          );
        finish(program, ctx);
      },
    }),
  };
}

function drawAtTurnStart(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
  ctx: Context,
) {
  const current = ctx.players.current();
  if (!current) return;
  const cardId = ctx.cards.drawOrRecycle<string>(program.deckId);
  ctx.effects.recordSource({
    playerId: current.id,
    deckId: program.deckId,
    ...(cardId ? { cardId } : {}),
  });
  if (!cardId) return finish(program, ctx);
  if (ctx.status.consume(current.id, program.discardNextDrawStatus)) {
    ctx.cards.discard(program.deckId, cardId);
    return;
  }
  const card = cards.get(cardId)!;
  ctx.events.message('game.card.drawn', {
    playerId: current.id,
    cardId,
    deckId: program.deckId,
  });
  if (isCollectible(card)) ctx.cards.give(program.handId, current.id, cardId);
  else {
    ctx.cards.discard(program.deckId, cardId);
    resolveImmediate(program, card, ctx);
  }
}

function resolveImmediate(
  program: MineDomainProgram,
  card: Card,
  ctx: Context,
) {
  const playerId = ctx.effects.sourcePlayerId();
  if (playerId != null)
    ctx.events.message(`${program.eventNamespace}.card.triggered`, {
      playerId,
      cardId: card.id,
    });
  ctx.effects.schedule(...card.effects);
}

function drawPassive(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
) {
  const cardId = ctx.cards.drawOrRecycle<string>(program.deckId);
  if (!cardId) return;
  if (isCollectible(cards.get(cardId)!))
    ctx.cards.give(program.handId, playerId, cardId);
  else ctx.cards.discard(program.deckId, cardId);
}

function recoverDiscard(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
) {
  const cardId = ctx.cards
    .discardPile<string>(program.deckId)
    .find((id) => isCollectible(cards.get(id)!));
  if (!cardId) return;
  ctx.cards.takeDiscard(program.deckId, cardId);
  ctx.cards.give(program.handId, playerId, cardId);
}

function removeRandomDomainCard(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
) {
  const items = ctx.inventory.items(program.inventoryId, playerId);
  const cardId = ctx.random.pick([
    ...items.filter((id) => cards.get(id)?.category === 'tresor'),
    ...items.filter((id) => cards.get(id)?.category === 'objet'),
  ]);
  if (!cardId)
    return void ctx.cards.discardRandom(
      program.handId,
      program.deckId,
      playerId,
    );
  ctx.inventory.remove(program.inventoryId, playerId, cardId);
  syncScore(program, cards, playerId, ctx);
  ctx.cards.discard(program.deckId, cardId);
}

function removeRandomTreasure(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
) {
  const treasures = ctx.inventory
    .items(program.inventoryId, playerId)
    .filter((id) => cards.get(id)?.category === 'tresor');
  const cardId = ctx.random.pick(treasures);
  if (!cardId) return;
  ctx.inventory.remove(program.inventoryId, playerId, cardId);
  syncScore(program, cards, playerId, ctx);
  ctx.cards.discard(program.deckId, cardId);
}

function trimHand(program: MineDomainProgram, playerId: number, ctx: Context) {
  for (const cardId of ctx.cards
    .hand<string>(program.handId, playerId)
    .slice(program.handLimit)
    .reverse())
    ctx.cards.play(program.handId, program.deckId, playerId, cardId);
}

function syncScore(
  program: MineDomainProgram,
  cards: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
) {
  const score = ctx.inventory
    .items(program.inventoryId, playerId)
    .reduce((total, id) => total + (cards.get(id)?.points ?? 0), 0);
  ctx.score.set(playerId, score);
}

function finish(program: MineDomainProgram, ctx: Context) {
  const winners = ctx.ranking.leaders(
    ctx.players.all().map(({ id }) => id),
    {
      value: (playerId) => ctx.score.get(playerId),
    },
  );
  ctx.match.finish({ winners, reason: program.finishReason });
}

function isCollectible(card: Card): boolean {
  return card.category === 'tresor' || card.category === 'objet';
}
