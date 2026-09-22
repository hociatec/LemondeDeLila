import { gameInput, gameEffects } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type { PublicDomainCardsProgram } from './program';
import {
  defineAction,
  defineEmptyAction,
} from '../../../engine/runtime/actions/action-builders';
import {
  defineEffect,
  defineEmptyEffect,
  defineActorEffect,
} from '../../../engine/runtime/effects/effects-core';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = PublicDomainCardsProgram['cards'][number];

export function publicDomainCardsRules(source: PublicDomainCardsProgram) {
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
          syncScore(actor.id, ctx);
        } else {
          ctx.cards.discard(program.deckId, card.id);
          resolveImmediate(card, ctx);
        }
        trimHand(actor.id, ctx);
        if (isCollectible(card)) ctx.turn.complete();
        else ctx.effects.schedule(gameEffects.completeTurn());
      },
      documentation: 'Pose une carte de domaine ou résout son effet immédiat.',
    }),
    pass: defineEmptyAction<State>({
      execute: ({ actor, ctx }) => {
        trimHand(actor.id, ctx);
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.complete();
      },
    }),
    lifecycle: {
      beforeTurn: ({ ctx }: { ctx: Context }) => drawAtTurnStart(ctx),
    },
    effects: publicDomainEffects(),
    enumerate,
  };

  function publicDomainEffects() {
    return {
      'cards-public-domain.remove-domain': defineEmptyEffect<State>(
        ({ targetPlayerIds, ctx }) => {
          const target = targetPlayerIds[0];
          if (target != null) removeRandomDomainCard(target, ctx);
        },
      ),
      'cards-public-domain.remove-domain-all': defineEmptyEffect<State>(
        ({ ctx }) => {
          for (const player of ctx.players.all())
            removeRandomDomainCard(player.id, ctx);
        },
      ),
      'cards-public-domain.remove-treasure-all': defineEffect<
        State,
        { count: number }
      >({
        input: gameInput.object({
          count: gameInput.number({ integer: true, min: 0 }),
        }),
        apply: ({ data, ctx }) => {
          for (const player of ctx.players.all())
            for (let index = 0; index < data.count; index += 1)
              removeRandomTreasure(player.id, ctx);
        },
      }),
      'cards-public-domain.recover-discard': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) => recoverDiscard(actorPlayerId, ctx),
      ),
      'cards-public-domain.draw-passive': defineEffect<
        State,
        { count: number }
      >({
        input: gameInput.object({
          count: gameInput.number({ integer: true, min: 0 }),
        }),
        apply: ({ targetPlayerIds, data, ctx }) => {
          for (const target of targetPlayerIds)
            for (let index = 0; index < data.count; index += 1)
              drawPassive(target, ctx);
        },
      }),
      'cards-public-domain.trim-hand': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) => trimHand(actorPlayerId, ctx),
      ),
      'cards-public-domain.double-next-player': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) => {
          const next = ctx.players.after(actorPlayerId)?.id;
          if (next == null) return;
          ctx.turn.to(next);
          ctx.turn.extra();
          ctx.turn.to(actorPlayerId);
        },
      ),
      'cards-public-domain.remove-treasure': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) => removeRandomTreasure(actorPlayerId, ctx),
      ),
      'cards-public-domain.finish': defineEmptyEffect<State>(
        ({ actorPlayerId, ctx }) => {
          if (actorPlayerId != null)
            ctx.events.message(
              `${program.eventNamespace}.final-collapse.triggered`,
              {
                playerId: actorPlayerId,
              },
            );
          finish(ctx);
        },
      ),
    };
  }

  function drawAtTurnStart(ctx: Context) {
    const current = ctx.players.current();
    if (!current) return;
    const cardId = ctx.cards.drawOrRecycle<string>(program.deckId);
    ctx.effects.recordSource({
      playerId: current.id,
      deckId: program.deckId,
      ...(cardId ? { cardId } : {}),
    });
    if (!cardId) return finish(ctx);
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
      resolveImmediate(card, ctx);
    }
  }

  function resolveImmediate(card: Card, ctx: Context) {
    const playerId = ctx.effects.sourcePlayerId();
    if (playerId != null)
      ctx.events.message(`${program.eventNamespace}.card.triggered`, {
        playerId,
        cardId: card.id,
      });
    ctx.effects.schedule(...card.effects);
  }

  function drawPassive(playerId: number, ctx: Context) {
    const cardId = ctx.cards.drawOrRecycle<string>(program.deckId);
    if (!cardId) return;
    if (isCollectible(cards.get(cardId)!))
      ctx.cards.give(program.handId, playerId, cardId);
    else ctx.cards.discard(program.deckId, cardId);
  }

  function recoverDiscard(playerId: number, ctx: Context) {
    const cardId = ctx.cards
      .discardPile<string>(program.deckId)
      .find((id) => isCollectible(cards.get(id)!));
    if (!cardId) return;
    ctx.cards.takeDiscard(program.deckId, cardId);
    ctx.cards.give(program.handId, playerId, cardId);
  }

  function removeRandomDomainCard(playerId: number, ctx: Context) {
    const items = ctx.inventory.items(program.inventoryId, playerId);
    const cardId = ctx.random.pick([
      ...program.collectibleCategories.flatMap((category) =>
        items.filter((id) => cards.get(id)?.category === category),
      ),
    ]);
    if (!cardId)
      return void ctx.cards.discardRandom(
        program.handId,
        program.deckId,
        playerId,
      );
    ctx.inventory.remove(program.inventoryId, playerId, cardId);
    syncScore(playerId, ctx);
    ctx.cards.discard(program.deckId, cardId);
  }

  function removeRandomTreasure(playerId: number, ctx: Context) {
    const treasures = ctx.inventory
      .items(program.inventoryId, playerId)
      .filter((id) => cards.get(id)?.category === program.lossCategory);
    const cardId = ctx.random.pick(treasures);
    if (!cardId) return;
    ctx.inventory.remove(program.inventoryId, playerId, cardId);
    syncScore(playerId, ctx);
    ctx.cards.discard(program.deckId, cardId);
  }

  function trimHand(playerId: number, ctx: Context) {
    for (const cardId of ctx.cards
      .hand<string>(program.handId, playerId)
      .slice(program.handLimit)
      .reverse())
      ctx.cards.play(program.handId, program.deckId, playerId, cardId);
  }

  function syncScore(playerId: number, ctx: Context) {
    const score = ctx.inventory
      .items(program.inventoryId, playerId)
      .reduce((total, id) => total + (cards.get(id)?.points ?? 0), 0);
    ctx.score.set(playerId, score);
  }

  function finish(ctx: Context) {
    const winners = ctx.ranking.leaders(
      ctx.players.all().map(({ id }) => id),
      {
        value: (playerId) => ctx.score.get(playerId),
      },
    );
    ctx.match.finish({ winners, reason: program.finishReason });
  }

  function isCollectible(card: Card): boolean {
    return program.collectibleCategories.includes(card.category);
  }
}
