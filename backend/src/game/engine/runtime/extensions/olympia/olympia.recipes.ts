import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import type { OlympiaCard, OlympiaProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { gameEffects } from '../../effects/effects-dsl';
import { defineEffect } from '../../effects/effects-core';
import { drawForPlayer } from '../../recipes/gameplay/card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function olympiaRules(source: OlympiaProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const draw = defineAction<State, { deck: string }>({
    input: gameInput.object({ deck: gameInput.enum(program.deckIds) }),
    documentation:
      'Pioche une carte dans un paquet non vide, une fois par tour.',
    available: ({ actor, ctx }) =>
      ctx.effects.sourcePlayerId() !== actor.id &&
      !ctx.status.has(actor.id, 'block_actions'),
    validate: ({ input, ctx }) => ctx.cards.deckCount(input.deck) > 0,
    enumerate: ({ actor, ctx }) =>
      ctx.effects.sourcePlayerId() === actor.id ||
      ctx.status.has(actor.id, 'block_actions')
        ? []
        : program.deckIds
            .filter((deck) => ctx.cards.deckCount(deck) > 0)
            .map((deck) => ({ deck })),
    execute: ({ actor, input, ctx }) => {
      if (ctx.effects.sourcePlayerId() === actor.id)
        throw new GameRuleViolationError('OLYMPIA_DRAW_ALREADY_DONE');
      const cardId = drawForPlayer<State, string>(ctx, {
        deckId: input.deck,
        handId: program.handId,
        playerId: actor.id,
      })[0];
      if (!cardId) throw new GameRuleViolationError('OLYMPIA_DECK_EMPTY');
      ctx.events.message('game.card.drawn', {
        playerId: actor.id,
        cardId,
        deckId: input.deck,
      });
    },
  });
  const play = defineAction<State, { cardId: string }>({
    input: gameInput.object({ cardId: gameInput.cardId() }),
    documentation: 'Joue une carte, applique ses effets puis termine le tour.',
    available: ({ actor, ctx }) => !ctx.status.has(actor.id, 'block_play'),
    validate: ({ actor, input, ctx }) =>
      isLegalPlay(program, cards, actor.id, input.cardId, ctx),
    enumerate: ({ actor, ctx }) =>
      ctx.status.has(actor.id, 'block_play')
        ? []
        : ctx.cards
            .hand<string>(program.handId, actor.id)
            .filter((cardId) => {
              const card = cards.get(cardId);
              return card && !isCardBlocked(card, actor.id, ctx);
            })
            .map((cardId) => ({ cardId })),
    execute: ({ actor, input, ctx }) => {
      const card = cards.get(input.cardId);
      if (!card) throw new GameRuleViolationError('OLYMPIA_CARD_UNKNOWN');
      if (isCardBlocked(card, actor.id, ctx))
        throw new GameRuleViolationError('OLYMPIA_CARD_BLOCKED');
      ctx.cards.play(program.handId, card.deck, actor.id, card.id);
      addCardPrestige(actor.id, card, ctx);
      ctx.effects.schedule(
        ...card.effects,
        gameEffects.custom('olympia.finish-card'),
        gameEffects.completeTurn(),
      );
    },
  });
  const pass = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
    documentation: 'Termine le tour sans jouer de carte.',
    execute: ({ ctx }) => ctx.turn.complete(),
  });
  return {
    draw,
    play,
    pass,
    effects: effects(program, cards),
    firstCard: (playerId: number, ctx: Context) =>
      ctx.cards.hand<string>(program.handId, playerId)[0],
  };
}
function effects(
  program: OlympiaProgram,
  cards: ReadonlyMap<string, OlympiaCard>,
) {
  return {
    'olympia.prestige': defineEffect<State, { value: number }>({
      input: gameInput.object({ value: gameInput.number() }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          addPrestige(playerId, data.value, ctx);
      },
    }),
    'olympia.steal': defineEffect<State, { value: number }>({
      input: gameInput.object({ value: gameInput.number({ min: 0 }) }),
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const victimId = targetPlayerIds[0];
        if (actorPlayerId == null || victimId == null) return;
        const amount = Math.min(data.value, ctx.score.get(victimId));
        addPrestige(victimId, -amount, ctx);
        addPrestige(actorPlayerId, amount, ctx);
      },
    }),
    'olympia.draw': defineEffect<State, { amount: number; decks: string[] }>({
      input: gameInput.object({
        amount: gameInput.number({ integer: true, min: 1 }),
        decks: gameInput.array(gameInput.enum(program.deckIds), { min: 1 }),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          drawCards(program, playerId, data.amount, data.decks, ctx);
      },
    }),
    'olympia.discard': defineEffect<
      State,
      { amount: number; categories: string[] }
    >({
      input: gameInput.object({
        amount: gameInput.number({ integer: true, min: 1 }),
        categories: gameInput.array(gameInput.string({ min: 1, max: 128 }), {
          min: 1,
        }),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          discardCards(
            program,
            cards,
            playerId,
            data.amount,
            data.categories,
            ctx,
          );
      },
    }),
    'olympia.exchange': defineEffect<State, { categories: string[] }>({
      input: gameInput.object({
        categories: gameInput.array(gameInput.string({ min: 1, max: 128 }), {
          min: 1,
        }),
      }),
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null)
          exchangeCards(
            program,
            cards,
            actorPlayerId,
            targetId,
            data.categories,
            ctx,
          );
      },
    }),
    'olympia.finish-card': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ ctx }) => chooseWinner(program, ctx),
    }),
  };
}

function isLegalPlay(
  program: OlympiaProgram,
  cards: ReadonlyMap<string, OlympiaCard>,
  actorId: number,
  cardId: string,
  ctx: Context,
): boolean {
  const card = cards.get(cardId);
  return Boolean(
    card &&
    ctx.cards.hand<string>(program.handId, actorId).includes(cardId) &&
    !isCardBlocked(card, actorId, ctx),
  );
}

function addCardPrestige(
  playerId: number,
  card: OlympiaCard,
  ctx: Context,
): void {
  let points = card.points ?? 0;
  if (card.category === 'exploit') {
    const double = statusValue(playerId, 'double_exploit', ctx);
    if (double > 0) points *= double;
    points += statusValue(playerId, 'exploit_bonus', ctx);
    points -= statusValue(playerId, 'exploit_penalty', ctx);
  }
  if (points > 0 && ctx.status.has(playerId, 'halved_gains'))
    points = Math.floor(points / 2);
  addPrestige(playerId, points, ctx);
  if (points !== 0)
    ctx.events.message('olympia.prestige.changed', { playerId, points });
}

function addPrestige(playerId: number, amount: number, ctx: Context): void {
  if (amount < 0 && ctx.status.has(playerId, 'shield')) return;
  ctx.score.set(playerId, Math.max(0, ctx.score.get(playerId) + amount));
}

function drawCards(
  program: OlympiaProgram,
  playerId: number,
  amount: number,
  decks: string[],
  ctx: Context,
): void {
  for (let index = 0; index < amount; index += 1) {
    const deck = decks.find((candidate) => ctx.cards.deckCount(candidate) > 0);
    if (!deck) return;
    drawForPlayer<State, string>(ctx, {
      deckId: deck,
      handId: program.handId,
      playerId,
    });
  }
}

function discardCards(
  program: OlympiaProgram,
  cards: ReadonlyMap<string, OlympiaCard>,
  playerId: number,
  amount: number,
  categories: string[],
  ctx: Context,
): void {
  const eligible = ctx.cards
    .hand<string>(program.handId, playerId)
    .filter((cardId) => categories.includes(cards.get(cardId)?.category ?? ''));
  for (const cardId of eligible.slice(0, amount)) {
    const card = cards.get(cardId);
    if (card) ctx.cards.play(program.handId, card.deck, playerId, cardId);
  }
}

function exchangeCards(
  program: OlympiaProgram,
  cards: ReadonlyMap<string, OlympiaCard>,
  actorId: number,
  targetId: number,
  categories: string[],
  ctx: Context,
): void {
  const eligible = (playerId: number) =>
    ctx.cards
      .hand<string>(program.handId, playerId)
      .find((cardId) => categories.includes(cards.get(cardId)?.category ?? ''));
  const actorCard = eligible(actorId);
  const targetCard = eligible(targetId);
  if (actorCard && targetCard)
    ctx.cards.exchange(
      program.handId,
      actorId,
      actorCard,
      targetId,
      targetCard,
    );
}

function isCardBlocked(card: OlympiaCard, playerId: number, ctx: Context) {
  if (card.category === 'heros')
    return (
      ctx.status.has(playerId, 'block_hero') ||
      ctx.status.has(playerId, 'block_hero_exploit') ||
      hasGlobalStatus('global_block_hero', ctx)
    );
  if (card.category === 'exploit')
    return (
      ctx.status.has(playerId, 'block_exploit') ||
      ctx.status.has(playerId, 'block_hero_exploit') ||
      hasGlobalStatus('global_block_exploit', ctx)
    );
  return false;
}

function chooseWinner(program: OlympiaProgram, ctx: Context): void {
  const winner = ctx.ranking.rank(
    ctx.players
      .all()
      .map((player) => player.id)
      .filter((id) => ctx.score.get(id) >= program.targetScore),
    { value: (id) => ctx.score.get(id), direction: 'desc' },
  )[0];
  if (winner)
    ctx.match.finish({
      winners: [winner.playerId],
      reason: program.winnerReason,
    });
}

function hasGlobalStatus(key: string, ctx: Context): boolean {
  return ctx.players.all().some((player) => ctx.status.has(player.id, key));
}

function statusValue(playerId: number, key: string, ctx: Context): number {
  const value = ctx.status.get(playerId, key)?.data.value;
  return typeof value === 'number' ? Math.max(1, value) : value == null ? 0 : 1;
}
