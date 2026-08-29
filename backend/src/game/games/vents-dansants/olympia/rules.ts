import {
  defineAction,
  defineEffect,
  drawForPlayer as drawCardsForPlayer,
  gameInput,
  gameEffects,
  rejectRule,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import {
  OLYMPIA_CARD_BY_ID,
  OLYMPIA_CATEGORIES,
  OLYMPIA_DECK_TYPES,
  type OlympiaCardDefinition,
  type OlympiaCategory,
  type OlympiaDeckType,
  type OlympiaStatusKey,
} from './content';
import type { NoGameState as OlympiaState } from '../../../engine/sdk/public-api';

const HANDS = 'players';
const PRESTIGE_TO_WIN = 30;
type RuleContext = GameContext<OlympiaState>;

const DECKS: OlympiaDeckType[] = [
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];

type DrawInput = { deck: OlympiaDeckType };
type PlayInput = { cardId: string };

export const drawCard = defineAction<OlympiaState, DrawInput>({
  input: gameInput.object({ deck: gameInput.enum(DECKS) }),
  documentation: 'Pioche une carte dans un paquet non vide, une fois par tour.',
  available: ({ actor, ctx }) =>
    ctx.effects.sourcePlayerId() !== actor.id &&
    !hasStatus(ctx, actor.id, 'block_actions'),
  validate: ({ input, ctx }) => ctx.cards.deckCount(input.deck) > 0,
  enumerate: ({ actor, ctx }) =>
    ctx.effects.sourcePlayerId() === actor.id ||
    hasStatus(ctx, actor.id, 'block_actions')
      ? []
      : DECKS.filter((deck) => ctx.cards.deckCount(deck) > 0).map((deck) => ({
          deck,
        })),
  execute: ({ actor, input, ctx }) => {
    if (ctx.effects.sourcePlayerId() === actor.id)
      rejectRule('Pioche déjà effectuée');
    const cardId = drawCardsForPlayer<OlympiaState, string>(ctx, {
      deckId: input.deck,
      handId: HANDS,
      playerId: actor.id,
    })[0];
    if (!cardId) rejectRule(`Le paquet ${input.deck} est vide`);
    ctx.events.message('game.card.drawn', {
      playerId: actor.id,
      cardId,
      deckId: input.deck,
    });
  },
});

export const playCard = defineAction<OlympiaState, PlayInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
  }),
  documentation:
    'Joue une carte, applique ses effets dans l’ordre puis termine le tour.',
  available: ({ actor, ctx }) => !hasStatus(ctx, actor.id, 'block_play'),
  validate: ({ actor, input, ctx }) => isLegalPlay(actor.id, input, ctx),
  enumerate: ({ actor, ctx }) =>
    hasStatus(ctx, actor.id, 'block_play')
      ? []
      : ctx.cards.hand<string>(HANDS, actor.id).flatMap((cardId) => {
          const card = OLYMPIA_CARD_BY_ID[cardId];
          if (!card || isCardBlocked(ctx, actor.id, card)) return [];
          return [{ cardId }];
        }),
  execute: ({ actor, input, ctx }) => {
    const card = requireOwnedCard(actor.id, input.cardId, ctx);
    if (isCardBlocked(ctx, actor.id, card)) {
      rejectRule('Cette catégorie de carte est bloquée');
    }
    ctx.cards.play(HANDS, card.deck, actor.id, card.id);
    addCardPrestige(actor.id, card, ctx);
    ctx.effects.schedule(
      ...card.effects,
      gameEffects.custom('olympia.finish-card'),
      gameEffects.completeTurn(),
    );
  },
});

export const pass = defineAction<OlympiaState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Termine le tour sans jouer de carte.',
  execute: ({ ctx }) => ctx.turn.complete(),
});

export const OLYMPIA_ACTIONS = {
  draw_card: drawCard,
  play_card: playCard,
  pass,
};

function isLegalPlay(
  actorId: number,
  input: PlayInput,
  ctx: RuleContext,
): boolean {
  const card = OLYMPIA_CARD_BY_ID[input.cardId];
  if (
    !card ||
    !ctx.cards.hand<string>(HANDS, actorId).includes(input.cardId) ||
    isCardBlocked(ctx, actorId, card)
  ) {
    return false;
  }
  return true;
}

function addCardPrestige(
  playerId: number,
  card: OlympiaCardDefinition,
  ctx: RuleContext,
): void {
  let points = card.points ?? 0;
  if (card.category === 'exploit') {
    const double = statusValue(ctx, playerId, 'double_exploit');
    if (double > 0) points *= double;
    points += statusValue(ctx, playerId, 'exploit_bonus');
    points -= statusValue(ctx, playerId, 'exploit_penalty');
  }
  if (points > 0 && hasStatus(ctx, playerId, 'halved_gains')) {
    points = Math.floor(points / 2);
  }
  addPrestige(ctx, playerId, points);
  if (points !== 0) {
    ctx.events.message('olympia.prestige.changed', { playerId, points });
  }
}

function addPrestige(ctx: RuleContext, playerId: number, amount: number): void {
  if (amount < 0 && hasStatus(ctx, playerId, 'shield')) return;
  ctx.score.set(playerId, Math.max(0, ctx.score.get(playerId) + amount));
}

function drawOlympiaCardsForPlayer(
  playerId: number,
  amount: number,
  decks: OlympiaDeckType[],
  ctx: RuleContext,
): void {
  for (let index = 0; index < amount; index += 1) {
    const deck = decks.find((candidate) => ctx.cards.deckCount(candidate) > 0);
    if (!deck) return;
    drawCardsForPlayer<OlympiaState, string>(ctx, {
      deckId: deck,
      handId: HANDS,
      playerId,
    });
  }
}

function discardCards(
  playerId: number,
  amount: number,
  categories: OlympiaCategory[],
  ctx: RuleContext,
): void {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const eligible = hand.filter((cardId) =>
    categories.includes(OLYMPIA_CARD_BY_ID[cardId]?.category),
  );
  for (const cardId of eligible.slice(0, amount)) {
    const card = OLYMPIA_CARD_BY_ID[cardId];
    ctx.cards.play(HANDS, card.deck, playerId, cardId);
  }
}

function exchangeCards(
  actorId: number,
  targetId: number,
  categories: OlympiaCategory[],
  ctx: RuleContext,
): void {
  const actorCard = ctx.cards
    .hand<string>(HANDS, actorId)
    .find((cardId) =>
      categories.includes(OLYMPIA_CARD_BY_ID[cardId]?.category),
    );
  const targetCard = ctx.cards
    .hand<string>(HANDS, targetId)
    .find((cardId) =>
      categories.includes(OLYMPIA_CARD_BY_ID[cardId]?.category),
    );
  if (!actorCard || !targetCard) return;
  ctx.cards.exchange(HANDS, actorId, actorCard, targetId, targetCard);
}

function isCardBlocked(
  ctx: RuleContext,
  playerId: number,
  card: OlympiaCardDefinition,
): boolean {
  if (card.category === 'heros') {
    return (
      hasStatus(ctx, playerId, 'block_hero') ||
      hasStatus(ctx, playerId, 'block_hero_exploit') ||
      hasGlobalStatus(ctx, 'global_block_hero')
    );
  }
  if (card.category === 'exploit') {
    return (
      hasStatus(ctx, playerId, 'block_exploit') ||
      hasStatus(ctx, playerId, 'block_hero_exploit') ||
      hasGlobalStatus(ctx, 'global_block_exploit')
    );
  }
  return false;
}

function requireOwnedCard(
  playerId: number,
  cardId: string,
  ctx: RuleContext,
): OlympiaCardDefinition {
  if (!ctx.cards.hand<string>(HANDS, playerId).includes(cardId)) {
    rejectRule('Carte Olympia absente de la main');
  }
  const card = OLYMPIA_CARD_BY_ID[cardId];
  if (!card) rejectRule('Carte Olympia inconnue');
  return card;
}

function chooseWinner(ctx: RuleContext): void {
  const reached = ctx.players
    .all()
    .filter((player) => ctx.score.get(player.id) >= PRESTIGE_TO_WIN)
    .sort((a, b) => ctx.score.get(b.id) - ctx.score.get(a.id) || a.id - b.id);
  if (reached.length > 0) {
    ctx.match.finish({ winners: [reached[0].id], reason: 'prestige-30' });
  }
}

function hasStatus(
  ctx: RuleContext,
  playerId: number,
  key: OlympiaStatusKey,
): boolean {
  return ctx.status.has(playerId, key);
}

function hasGlobalStatus(ctx: RuleContext, key: OlympiaStatusKey): boolean {
  return ctx.players.all().some((player) => ctx.status.has(player.id, key));
}

function statusValue(
  ctx: RuleContext,
  playerId: number,
  key: OlympiaStatusKey,
): number {
  const status = ctx.status.get(playerId, key);
  if (!status) return 0;
  const value = status.data.value;
  return typeof value === 'number' ? Math.max(1, value) : 1;
}

export const OLYMPIA_EFFECTS = {
  'olympia.prestige': defineEffect<OlympiaState, { value: number }>({
    input: gameInput.object({ value: gameInput.number() }),
    apply: ({ targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        addPrestige(ctx, playerId, data.value);
      }
    },
  }),
  'olympia.steal': defineEffect<OlympiaState, { value: number }>({
    input: gameInput.object({
      value: gameInput.number({ min: 0 }),
    }),
    apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
      const victimId = targetPlayerIds[0];
      if (actorPlayerId == null || victimId == null) return;
      const amount = Math.min(data.value, ctx.score.get(victimId));
      addPrestige(ctx, victimId, -amount);
      addPrestige(ctx, actorPlayerId, amount);
    },
  }),
  'olympia.draw': defineEffect<
    OlympiaState,
    { amount: number; decks: OlympiaDeckType[] }
  >({
    input: gameInput.object({
      amount: gameInput.number({ integer: true, min: 1 }),
      decks: gameInput.array(gameInput.enum(OLYMPIA_DECK_TYPES), { min: 1 }),
    }),
    apply: ({ targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        drawOlympiaCardsForPlayer(playerId, data.amount, data.decks, ctx);
      }
    },
  }),
  'olympia.discard': defineEffect<
    OlympiaState,
    { amount: number; categories: OlympiaCategory[] }
  >({
    input: gameInput.object({
      amount: gameInput.number({ integer: true, min: 1 }),
      categories: gameInput.array(gameInput.enum(OLYMPIA_CATEGORIES), {
        min: 1,
      }),
    }),
    apply: ({ targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        discardCards(playerId, data.amount, data.categories, ctx);
      }
    },
  }),
  'olympia.exchange': defineEffect<
    OlympiaState,
    { categories: OlympiaCategory[] }
  >({
    input: gameInput.object({
      categories: gameInput.array(gameInput.enum(OLYMPIA_CATEGORIES), {
        min: 1,
      }),
    }),
    apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        exchangeCards(actorPlayerId, targetId, data.categories, ctx);
      }
    },
  }),
  'olympia.finish-card': defineEffect<OlympiaState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ ctx }) => chooseWinner(ctx),
  }),
} as const;
