import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  OLYMPIA_CARD_BY_ID,
  type OlympiaCardDefinition,
  type OlympiaCategory,
  type OlympiaDeckType,
  type OlympiaEffect,
} from './content';
import type { OlympiaState, OlympiaStatus } from './state';

const HANDS = 'players';
const PRESTIGE_TO_WIN = 30;
type RuleContext = GameRuleContext<OlympiaState>;

const DECKS: OlympiaDeckType[] = [
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];

type DrawInput = { deck: OlympiaDeckType };
type PlayInput = { cardId: string; targetPlayerId?: number };

export const drawCard = defineAction<OlympiaState, DrawInput>({
  input: gameInput.object({ deck: gameInput.enum(DECKS) }),
  documentation: 'Pioche une carte dans un paquet non vide, une fois par tour.',
  available: ({ state, actor }) =>
    state.drawnPlayerId !== actor.id &&
    !hasStatus(state, actor.id, 'block_actions'),
  availableInputs: ({ state, actor, ctx }) =>
    state.drawnPlayerId === actor.id ||
    hasStatus(state, actor.id, 'block_actions')
      ? []
      : DECKS.filter((deck) => ctx.cards.deckCount(deck) > 0).map((deck) => ({
          deck,
        })),
  execute: ({ state, actor, input, ctx }) => {
    if (state.drawnPlayerId === actor.id)
      throw new Error('Pioche déjà effectuée');
    const cardId = ctx.cards.draw<string>(input.deck);
    if (!cardId) throw new Error(`Le paquet ${input.deck} est vide`);
    ctx.cards.give(HANDS, actor.id, cardId);
    state.drawnPlayerId = actor.id;
    ctx.history.add(`${actor.username} pioche une carte ${input.deck}.`);
  },
});

export const playCard = defineAction<OlympiaState, PlayInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
  }),
  documentation:
    'Joue une carte, applique ses effets dans l’ordre puis termine le tour.',
  available: ({ state, actor }) => !hasStatus(state, actor.id, 'block_play'),
  availableInputs: ({ state, actor, ctx }) =>
    hasStatus(state, actor.id, 'block_play')
      ? []
      : ctx.cards.hand<string>(HANDS, actor.id).flatMap((cardId) => {
          const card = OLYMPIA_CARD_BY_ID[cardId];
          if (!card || isCardBlocked(state, actor.id, card)) return [];
          const targets = requiresTarget(card)
            ? ctx.players
                .all()
                .filter((player) => player.id !== actor.id)
                .map((player) => player.id)
            : [undefined];
          return targets.map((targetPlayerId) => ({ cardId, targetPlayerId }));
        }),
  execute: ({ state, actor, input, ctx }) => {
    const card = requireOwnedCard(actor.id, input.cardId, ctx);
    if (isCardBlocked(state, actor.id, card)) {
      throw new Error('Cette catégorie de carte est bloquée');
    }
    if (requiresTarget(card) && input.targetPlayerId == null) {
      throw new Error('Cette carte exige une cible');
    }
    if (
      input.targetPlayerId != null &&
      (input.targetPlayerId === actor.id ||
        !ctx.players.get(input.targetPlayerId))
    ) {
      throw new Error('Cible Olympia invalide');
    }
    ctx.cards.play(HANDS, card.deck, actor.id, card.id);
    addCardPrestige(state, actor.id, card, ctx);
    const effects = card.effect
      ? Array.isArray(card.effect)
        ? card.effect
        : [card.effect]
      : [];
    for (const effect of effects) {
      applyEffect(state, actor.id, input.targetPlayerId ?? null, effect, ctx);
    }
    chooseWinner(state, ctx);
    if (state.winnerIds.length === 0) endTurn(state, ctx);
  },
});

export const pass = defineAction<OlympiaState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Termine le tour sans jouer de carte.',
  execute: ({ state, ctx }) => endTurn(state, ctx),
});

export const OLYMPIA_ACTIONS = {
  draw_card: drawCard,
  play_card: playCard,
  pass,
};

export function skipOlympiaPlayer(state: OlympiaState, ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} passe son tour.`);
  endTurn(state, ctx);
}

function applyEffect(
  state: OlympiaState,
  actorId: number,
  targetId: number | null,
  effect: OlympiaEffect,
  ctx: RuleContext,
): void {
  if (effect.type === 'prestige') {
    for (const playerId of targets(effect.target, actorId, targetId, ctx)) {
      addPrestige(state, playerId, effect.value);
    }
  } else if (effect.type === 'steal') {
    const victim = targetId ?? otherPlayerIds(actorId, ctx)[0];
    if (victim != null) {
      const amount = Math.min(effect.value, state.prestige[victim]);
      addPrestige(state, victim, -amount);
      addPrestige(state, actorId, amount);
    }
  } else if (effect.type === 'draw') {
    for (const playerId of targets(effect.target, actorId, targetId, ctx)) {
      drawForPlayer(playerId, effect.amount, effect.decks, ctx);
    }
  } else if (effect.type === 'status') {
    for (const playerId of targets(effect.target, actorId, targetId, ctx)) {
      state.statuses[playerId].push({
        key: effect.key,
        turns: effect.turns,
        ...(effect.value == null ? {} : { value: effect.value }),
      });
    }
  } else if (effect.type === 'discard') {
    for (const playerId of targets(effect.target, actorId, targetId, ctx)) {
      discardCards(playerId, effect.amount, effect.categories, ctx);
    }
  } else if (effect.type === 'exchange' && targetId != null) {
    exchangeCards(actorId, targetId, effect.categories, ctx);
  } else if (effect.type === 'skip' && targetId != null) {
    state.skipTurns[targetId] += effect.turns;
  }
}

function addCardPrestige(
  state: OlympiaState,
  playerId: number,
  card: OlympiaCardDefinition,
  ctx: RuleContext,
): void {
  let points = card.points ?? 0;
  if (card.category === 'exploit') {
    const double = statusValue(state, playerId, 'double_exploit');
    if (double > 0) points *= double;
    points += statusValue(state, playerId, 'exploit_bonus');
    points -= statusValue(state, playerId, 'exploit_penalty');
  }
  if (points > 0 && hasStatus(state, playerId, 'halved_gains')) {
    points = Math.floor(points / 2);
  }
  addPrestige(state, playerId, points);
  if (points !== 0) ctx.history.add(`Gain de prestige : ${points}.`);
}

function addPrestige(
  state: OlympiaState,
  playerId: number,
  amount: number,
): void {
  if (amount < 0 && hasStatus(state, playerId, 'shield')) return;
  state.prestige[playerId] = Math.max(0, state.prestige[playerId] + amount);
}

function drawForPlayer(
  playerId: number,
  amount: number,
  decks: OlympiaDeckType[],
  ctx: RuleContext,
): void {
  for (let index = 0; index < amount; index += 1) {
    const deck = decks.find((candidate) => ctx.cards.deckCount(candidate) > 0);
    if (!deck) return;
    const card = ctx.cards.draw<string>(deck);
    if (card) ctx.cards.give(HANDS, playerId, card);
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
  ctx.cards.take(HANDS, actorId, actorCard);
  ctx.cards.take(HANDS, targetId, targetCard);
  ctx.cards.give(HANDS, actorId, targetCard);
  ctx.cards.give(HANDS, targetId, actorCard);
}

function targets(
  descriptor: 'self' | 'target' | 'all' | 'others',
  actorId: number,
  targetId: number | null,
  ctx: RuleContext,
): number[] {
  if (descriptor === 'self') return [actorId];
  if (descriptor === 'target') return targetId == null ? [] : [targetId];
  if (descriptor === 'all') return ctx.players.all().map((player) => player.id);
  return otherPlayerIds(actorId, ctx);
}

function requiresTarget(card: OlympiaCardDefinition): boolean {
  const effects = card.effect
    ? Array.isArray(card.effect)
      ? card.effect
      : [card.effect]
    : [];
  return effects.some(
    (effect) =>
      ('target' in effect && effect.target === 'target') ||
      effect.type === 'exchange',
  );
}

function isCardBlocked(
  state: OlympiaState,
  playerId: number,
  card: OlympiaCardDefinition,
): boolean {
  if (card.category === 'heros') {
    return (
      hasStatus(state, playerId, 'block_hero') ||
      hasStatus(state, playerId, 'block_hero_exploit') ||
      hasGlobalStatus(state, 'global_block_hero')
    );
  }
  if (card.category === 'exploit') {
    return (
      hasStatus(state, playerId, 'block_exploit') ||
      hasStatus(state, playerId, 'block_hero_exploit') ||
      hasGlobalStatus(state, 'global_block_exploit')
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
    throw new Error('Carte Olympia absente de la main');
  }
  const card = OLYMPIA_CARD_BY_ID[cardId];
  if (!card) throw new Error('Carte Olympia inconnue');
  return card;
}

function endTurn(state: OlympiaState, ctx: RuleContext): void {
  for (const player of ctx.players.all()) {
    state.statuses[player.id] = state.statuses[player.id]
      .map((status) => ({ ...status, turns: status.turns - 1 }))
      .filter((status) => status.turns > 0);
  }
  state.drawnPlayerId = null;
  ctx.turn.end();
}

function chooseWinner(state: OlympiaState, ctx: RuleContext): void {
  const reached = ctx.players
    .all()
    .filter((player) => state.prestige[player.id] >= PRESTIGE_TO_WIN)
    .sort((a, b) => state.prestige[b.id] - state.prestige[a.id] || a.id - b.id);
  if (reached.length > 0) state.winnerIds = [reached[0].id];
}

function hasStatus(
  state: OlympiaState,
  playerId: number,
  key: OlympiaStatus['key'],
): boolean {
  return state.statuses[playerId].some(
    (status) => status.key === key && status.turns > 0,
  );
}

function hasGlobalStatus(
  state: OlympiaState,
  key: OlympiaStatus['key'],
): boolean {
  return Object.values(state.statuses).some((statuses) =>
    statuses.some((status) => status.key === key && status.turns > 0),
  );
}

function statusValue(
  state: OlympiaState,
  playerId: number,
  key: OlympiaStatus['key'],
): number {
  return state.statuses[playerId]
    .filter((status) => status.key === key && status.turns > 0)
    .reduce((maximum, status) => Math.max(maximum, status.value ?? 1), 0);
}

function otherPlayerIds(actorId: number, ctx: RuleContext): number[] {
  return ctx.players
    .all()
    .filter((player) => player.id !== actorId)
    .map((player) => player.id);
}
