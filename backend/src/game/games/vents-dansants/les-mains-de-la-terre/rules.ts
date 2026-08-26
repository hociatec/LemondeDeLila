import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  isLesMainsSpecialCard,
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_FAMILIES,
  LES_MAINS_FAMILY_SIZE,
  LES_MAINS_METIER_CARDS,
  type LesMainsFamily,
} from './content';
import type { LesMainsState } from './state';

const DECK = 'professions';
const HANDS = 'players';
type RuleContext = GameRuleContext<LesMainsState>;

export const requestCard = defineAction<
  LesMainsState,
  { cardId: string; targetPlayerId: number }
>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.playerId(),
  }),
  documentation: 'Demande une carte métier précise à un autre joueur.',
  availableInputs: ({ state, actor, ctx }) =>
    enumerateRequests(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    state.freeFamilyRequest[actor.id] = false;
    const targetHand = ctx.cards.hand<string>(HANDS, input.targetPlayerId);
    if (targetHand.includes(input.cardId)) {
      ctx.cards.take(HANDS, input.targetPlayerId, input.cardId);
      ctx.cards.give(HANDS, actor.id, input.cardId);
      ctx.history.add(`${actor.username} récupère ${cardName(input.cardId)}.`);
      completeFamily(state, actor.id, input.cardId, ctx);
      maybeFinish(state, ctx);
      return;
    }
    const drawCount = 1 + state.extraDraws[actor.id];
    state.extraDraws[actor.id] = 0;
    for (let count = 0; count < drawCount; count += 1) {
      drawCard(state, actor.id, ctx);
    }
    maybeFinish(state, ctx);
    if (!state.gameOver) ctx.turn.end();
  },
});

export const LES_MAINS_ACTIONS = { request_card: requestCard };

export function enumerateRequests(
  state: LesMainsState,
  playerId: number,
  ctx: RuleContext,
): Array<{ cardId: string; targetPlayerId: number }> {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const ownedFamilies = state.freeFamilyRequest[playerId]
    ? new Set(LES_MAINS_FAMILIES)
    : new Set(
        hand
          .map((cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family)
          .filter((family): family is LesMainsFamily => family != null),
      );
  return ctx.players
    .all()
    .filter((target) => target.id !== playerId)
    .flatMap((target) =>
      LES_MAINS_METIER_CARDS.filter(
        (card) => card.family != null && ownedFamilies.has(card.family),
      ).map((card) => ({ cardId: card.id, targetPlayerId: target.id })),
    );
}

export function dealProfessionHands(
  playerIds: readonly number[],
  ctx: RuleContext,
): void {
  const specialBuffer: string[] = [];
  const queue = [...playerIds];
  while (queue.length > 0 && ctx.cards.deckCount(DECK) > 0) {
    const playerId = queue.shift();
    if (playerId == null) break;
    const cardId = ctx.cards.draw<string>(DECK);
    if (!cardId) break;
    if (isLesMainsSpecialCard(cardId)) {
      specialBuffer.push(cardId);
      queue.unshift(playerId);
      continue;
    }
    ctx.cards.give(HANDS, playerId, cardId);
    if (ctx.cards.hand(HANDS, playerId).length < 6) queue.push(playerId);
  }
  ctx.cards.putOnTop(DECK, specialBuffer);
}

export function skipStrikingPlayer(
  state: LesMainsState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(
    `${current.username} participe à la grève et saute son tour.`,
  );
  ctx.turn.end();
}

function drawCard(
  state: LesMainsState,
  playerId: number,
  ctx: RuleContext,
): void {
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  if (!cardId) return;
  if (isLesMainsSpecialCard(cardId)) {
    ctx.cards.discard(DECK, cardId);
    applySpecial(state, playerId, cardId, ctx);
    return;
  }
  ctx.cards.give(HANDS, playerId, cardId);
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} pioche ${cardName(cardId)}.`,
  );
  completeFamily(state, playerId, cardId, ctx);
}

function applySpecial(
  state: LesMainsState,
  playerId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  if (cardId === 'special-voyage-autour-du-monde')
    exchangeRandom(playerId, ctx);
  else if (cardId === 'special-metier-disparu')
    completeVanished(state, playerId, ctx);
  else if (cardId === 'special-formation-express')
    state.extraDraws[playerId] += 1;
  else if (cardId === 'special-greve-mondiale') {
    for (const player of ctx.players.all()) {
      if (player.id !== playerId) state.skipTurns[player.id] += 1;
    }
  } else if (cardId === 'special-boussole-perdue') mixHands(playerId, ctx);
  else if (cardId === 'special-passation-de-savoir')
    passKnowledge(state, playerId, ctx);
  else if (cardId === 'special-fete-du-metier')
    state.freeFamilyRequest[playerId] = true;
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} applique ${cardName(cardId)}.`,
  );
}

function completeFamily(
  state: LesMainsState,
  playerId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  const family = LES_MAINS_CARD_BY_ID[cardId]?.family;
  if (!family || state.completedFamilies[playerId].includes(family)) return;
  const cards = ctx.cards
    .hand<string>(HANDS, playerId)
    .filter((candidate) => LES_MAINS_CARD_BY_ID[candidate]?.family === family);
  if (cards.length < LES_MAINS_FAMILY_SIZE) return;
  for (const familyCard of cards)
    ctx.cards.play(HANDS, DECK, playerId, familyCard);
  state.completedFamilies[playerId].push(family);
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} complète la famille ${family}.`,
  );
}

function completeVanished(
  state: LesMainsState,
  playerId: number,
  ctx: RuleContext,
): void {
  if (state.vanishedProfessionUsed[playerId]) return;
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const ranked = LES_MAINS_FAMILIES.filter(
    (family) => !state.completedFamilies[playerId].includes(family),
  )
    .map((family) => ({
      family,
      cards: hand.filter(
        (cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family === family,
      ),
    }))
    .sort((left, right) => right.cards.length - left.cards.length);
  const selected = ranked[0];
  if (!selected || selected.cards.length === 0) return;
  for (const cardId of selected.cards)
    ctx.cards.play(HANDS, DECK, playerId, cardId);
  state.completedFamilies[playerId].push(selected.family);
  state.vanishedProfessionUsed[playerId] = true;
}

function exchangeRandom(playerId: number, ctx: RuleContext): void {
  const ownHand = ctx.cards.hand<string>(HANDS, playerId);
  const target = ctx.random.pick(
    ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== playerId && ctx.cards.hand(HANDS, player.id).length > 0,
      ),
  );
  const ownCard = ctx.random.pick(ownHand);
  const targetCard = target
    ? ctx.random.pick(ctx.cards.hand<string>(HANDS, target.id))
    : null;
  if (!target || !ownCard || !targetCard) return;
  ctx.cards.take(HANDS, playerId, ownCard);
  ctx.cards.take(HANDS, target.id, targetCard);
  ctx.cards.give(HANDS, playerId, targetCard);
  ctx.cards.give(HANDS, target.id, ownCard);
}

function mixHands(playerId: number, ctx: RuleContext): void {
  const target = ctx.random.pick(
    ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== playerId && ctx.cards.hand(HANDS, player.id).length > 0,
      ),
  );
  if (!target) return;
  const own = ctx.cards.hand<string>(HANDS, playerId);
  const other = ctx.cards.hand<string>(HANDS, target.id);
  const ownSize = own.length;
  const shuffled = ctx.random.shuffle([...own, ...other]);
  own.splice(0, own.length, ...shuffled.slice(0, ownSize));
  other.splice(0, other.length, ...shuffled.slice(ownSize));
}

function passKnowledge(
  state: LesMainsState,
  playerId: number,
  ctx: RuleContext,
): void {
  const ownFamilies = new Set(
    ctx.cards
      .hand<string>(HANDS, playerId)
      .map((cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family),
  );
  const candidates = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .flatMap((player) =>
      ctx.cards
        .hand<string>(HANDS, player.id)
        .filter((cardId) =>
          ownFamilies.has(LES_MAINS_CARD_BY_ID[cardId]?.family),
        )
        .map((cardId) => ({ playerId: player.id, cardId })),
    );
  const selected = ctx.random.pick(candidates);
  if (!selected) return;
  ctx.cards.take(HANDS, selected.playerId, selected.cardId);
  ctx.cards.give(HANDS, playerId, selected.cardId);
  completeFamily(state, playerId, selected.cardId, ctx);
}

function maybeFinish(state: LesMainsState, ctx: RuleContext): void {
  const total = Object.values(state.completedFamilies).reduce(
    (sum, families) => sum + families.length,
    0,
  );
  const noCardsRemain =
    ctx.cards.deckCount(DECK) === 0 && ctx.cards.discardCount(DECK) === 0;
  const handless = ctx.players
    .all()
    .some((player) => ctx.cards.hand(HANDS, player.id).length === 0);
  if (total < LES_MAINS_FAMILIES.length && !(noCardsRemain && handless)) return;
  const scores = ctx.players.all().map((player) => ({
    playerId: player.id,
    score: state.completedFamilies[player.id].length,
  }));
  const best = Math.max(...scores.map((entry) => entry.score));
  state.winnerIds = scores
    .filter((entry) => entry.score === best)
    .map((entry) => entry.playerId);
  state.gameOver = true;
}

function cardName(cardId: string): string {
  return LES_MAINS_CARD_BY_ID[cardId]?.name ?? cardId;
}
