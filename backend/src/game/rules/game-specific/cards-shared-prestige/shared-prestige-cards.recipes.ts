import {
  gameInput,
  gameEffects,
  drawForPlayer,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { GameRuleViolationError } from '../../../engine/sdk/extension-api';
import {
  defineAction,
  defineEmptyAction,
} from '../../../engine/sdk/extension-api';
import type {
  SharedPrestigeCardsCard,
  SharedPrestigeCardsProgram,
} from './program';
import {
  defineEffect,
  defineEmptyEffect,
} from '../../../engine/sdk/extension-api';

type State = Record<string, never>;
type Context = GameContext<State>;

export function sharedPrestigeCardsRules(source: SharedPrestigeCardsProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const draw = defineAction<State, { deck: string }>({
    input: gameInput.object({ deck: gameInput.enum(program.deckIds) }),
    documentation:
      'Pioche une carte dans un paquet non vide, une fois par tour.',
    available: ({ actor, ctx }) =>
      ctx.effects.sourcePlayerId() !== actor.id &&
      !ctx.status.has(actor.id, program.mechanics.blockDrawStatus),
    validate: ({ input, ctx }) => ctx.cards.deckCount(input.deck) > 0,
    enumerate: ({ actor, ctx }) =>
      ctx.effects.sourcePlayerId() === actor.id ||
      ctx.status.has(actor.id, program.mechanics.blockDrawStatus)
        ? []
        : program.deckIds
            .filter((deck) => ctx.cards.deckCount(deck) > 0)
            .map((deck) => ({ deck })),
    execute: ({ actor, input, ctx }) => {
      if (ctx.effects.sourcePlayerId() === actor.id)
        throw new GameRuleViolationError('SHARED_PRESTIGE_DRAW_ALREADY_DONE');
      const cardId = drawForPlayer<State, string>(ctx, {
        deckId: input.deck,
        handId: program.handId,
        playerId: actor.id,
      })[0];
      if (!cardId)
        throw new GameRuleViolationError('SHARED_PRESTIGE_DECK_EMPTY');
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
    available: ({ actor, ctx }) =>
      !ctx.status.has(actor.id, program.mechanics.blockPlayStatus),
    validate: ({ actor, input, ctx }) =>
      isLegalPlay(program, cards, actor.id, input.cardId, ctx),
    enumerate: ({ actor, ctx }) =>
      ctx.status.has(actor.id, program.mechanics.blockPlayStatus)
        ? []
        : ctx.cards
            .hand<string>(program.handId, actor.id)
            .filter((cardId) => {
              const card = cards.get(cardId);
              return card && !isCardBlocked(program, card, actor.id, ctx);
            })
            .map((cardId) => ({ cardId })),
    execute: ({ actor, input, ctx }) => {
      const card = cards.get(input.cardId);
      if (!card)
        throw new GameRuleViolationError('SHARED_PRESTIGE_CARD_UNKNOWN');
      if (isCardBlocked(program, card, actor.id, ctx))
        throw new GameRuleViolationError('SHARED_PRESTIGE_CARD_BLOCKED');
      ctx.cards.play(program.handId, card.deck, actor.id, card.id);
      addCardPrestige(program, actor.id, card, ctx);
      ctx.effects.schedule(
        ...card.effects,
        gameEffects.custom('cards-shared-prestige.finish-card'),
        gameEffects.completeTurn(),
      );
    },
  });
  const pass = defineEmptyAction<State>({
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
  program: SharedPrestigeCardsProgram,
  cards: ReadonlyMap<string, SharedPrestigeCardsCard>,
) {
  return {
    'cards-shared-prestige.prestige': defineEffect<State, { value: number }>({
      input: gameInput.object({ value: gameInput.number() }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          addPrestige(program, playerId, data.value, ctx);
      },
    }),
    'cards-shared-prestige.steal': defineEffect<State, { value: number }>({
      input: gameInput.object({ value: gameInput.number({ min: 0 }) }),
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const victimId = targetPlayerIds[0];
        if (actorPlayerId == null || victimId == null) return;
        const amount = Math.min(data.value, ctx.score.get(victimId));
        addPrestige(program, victimId, -amount, ctx);
        addPrestige(program, actorPlayerId, amount, ctx);
      },
    }),
    'cards-shared-prestige.draw': defineEffect<
      State,
      { amount: number; decks: string[] }
    >({
      input: gameInput.object({
        amount: gameInput.number({ integer: true, min: 1 }),
        decks: gameInput.array(gameInput.enum(program.deckIds), { min: 1 }),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          drawCards(program, playerId, data.amount, data.decks, ctx);
      },
    }),
    'cards-shared-prestige.discard': defineEffect<
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
    'cards-shared-prestige.exchange': defineEffect<
      State,
      { categories: string[] }
    >({
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
    'cards-shared-prestige.finish-card': defineEmptyEffect<State>(({ ctx }) =>
      chooseWinner(program, ctx),
    ),
  };
}

function isLegalPlay(
  program: SharedPrestigeCardsProgram,
  cards: ReadonlyMap<string, SharedPrestigeCardsCard>,
  actorId: number,
  cardId: string,
  ctx: Context,
): boolean {
  const card = cards.get(cardId);
  return Boolean(
    card &&
    ctx.cards.hand<string>(program.handId, actorId).includes(cardId) &&
    !isCardBlocked(program, card, actorId, ctx),
  );
}

function addCardPrestige(
  program: SharedPrestigeCardsProgram,
  playerId: number,
  card: SharedPrestigeCardsCard,
  ctx: Context,
): void {
  let points = card.points ?? 0;
  const rule = program.mechanics.categories.find(
    (entry) => entry.category === card.category,
  );
  if (rule) {
    const multiplier = rule.multiplierStatus
      ? statusValue(playerId, rule.multiplierStatus, ctx)
      : 0;
    if (multiplier > 0) points *= multiplier;
    if (rule.bonusStatus)
      points += statusValue(playerId, rule.bonusStatus, ctx);
    if (rule.penaltyStatus)
      points -= statusValue(playerId, rule.penaltyStatus, ctx);
  }
  if (
    points > 0 &&
    ctx.status.has(playerId, program.mechanics.reducedGainStatus)
  )
    points = Math.floor(points / program.mechanics.gainDivisor);
  addPrestige(program, playerId, points, ctx);
  if (points !== 0)
    ctx.events.message('cards-shared-prestige.prestige.changed', {
      playerId,
      points,
    });
}

function addPrestige(
  program: SharedPrestigeCardsProgram,
  playerId: number,
  amount: number,
  ctx: Context,
): void {
  if (
    amount < 0 &&
    ctx.status.has(playerId, program.mechanics.lossProtectionStatus)
  )
    return;
  ctx.score.set(playerId, Math.max(0, ctx.score.get(playerId) + amount));
}

function drawCards(
  program: SharedPrestigeCardsProgram,
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
  program: SharedPrestigeCardsProgram,
  cards: ReadonlyMap<string, SharedPrestigeCardsCard>,
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
  program: SharedPrestigeCardsProgram,
  cards: ReadonlyMap<string, SharedPrestigeCardsCard>,
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

function isCardBlocked(
  program: SharedPrestigeCardsProgram,
  card: SharedPrestigeCardsCard,
  playerId: number,
  ctx: Context,
) {
  const rule = program.mechanics.categories.find(
    (entry) => entry.category === card.category,
  );
  return (
    rule != null &&
    (rule.blockedBy.some((status) => ctx.status.has(playerId, status)) ||
      rule.globallyBlockedBy.some((status) => hasGlobalStatus(status, ctx)))
  );
}

function chooseWinner(program: SharedPrestigeCardsProgram, ctx: Context): void {
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
