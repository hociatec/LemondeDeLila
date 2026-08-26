import {
  defineEffect,
  drawEvent,
  gameInput,
  requestCardFromPlayer,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import {
  isLesMainsSpecialCard,
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_FAMILIES,
  LES_MAINS_METIER_CARDS,
  type LesMainsFamily,
} from './content';
import type { LesMainsState } from './state';

const DECK = 'professions';
const HANDS = 'players';
const FAMILIES = 'profession-families';
export const LES_MAINS_EXTRA_DRAWS = 'les-mains.extra-draws';
export const LES_MAINS_FREE_REQUEST = 'les-mains.free-family-request';
export const LES_MAINS_VANISHED_USED = 'les-mains.vanished-used';
type RuleContext = GameContext<LesMainsState>;

export const requestCard = requestCardFromPlayer<LesMainsState>({
  handId: HANDS,
  requests: ({ state, playerId, ctx }) =>
    enumerateRequests(state, playerId, ctx),
  beforeRequest: ({ playerId, ctx }) => {
    ctx.status.remove(playerId, LES_MAINS_FREE_REQUEST);
  },
  onReceived: ({ state: _state, playerId, cardId, ctx }) => {
    ctx.events.message('game.card.received', { playerId, cardId });
    completeFamily(playerId, cardId, ctx);
    maybeFinish(ctx);
  },
  onMiss: ({ state: _state, playerId, ctx }) => {
    const drawCount = 1 + ctx.resources.get(playerId, LES_MAINS_EXTRA_DRAWS);
    ctx.resources.set(playerId, LES_MAINS_EXTRA_DRAWS, 0);
    for (let count = 0; count < drawCount; count += 1) {
      drawLesMainsCard(playerId, ctx);
    }
    maybeFinish(ctx);
  },
});

export const LES_MAINS_ACTIONS = { request_card: requestCard };

export function enumerateRequests(
  _state: LesMainsState,
  playerId: number,
  ctx: RuleContext,
): Array<{ cardId: string; targetPlayerId: number }> {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const ownedFamilies = ctx.status.has(playerId, LES_MAINS_FREE_REQUEST)
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

function drawLesMainsCard(playerId: number, ctx: RuleContext): void {
  const cardId = drawEvent<LesMainsState, string>(ctx, {
    deckId: DECK,
    playerId,
    recycle: true,
  });
  if (!cardId) return;
  if (isLesMainsSpecialCard(cardId)) {
    ctx.cards.discard(DECK, cardId);
    const card = LES_MAINS_CARD_BY_ID[cardId];
    if (card) ctx.effects.schedule(...card.effects);
    return;
  }
  ctx.cards.give(HANDS, playerId, cardId);
  ctx.events.message('game.card.drawn', { playerId, cardId, deckId: DECK });
  completeFamily(playerId, cardId, ctx);
}

function completeFamily(
  playerId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  const family = LES_MAINS_CARD_BY_ID[cardId]?.family;
  if (!family || !ctx.cards.completeSet(FAMILIES, playerId, family)) return;
  ctx.events.message('les-mains.family.completed', {
    playerId,
    familyId: family,
  });
}

function completeVanished(playerId: number, ctx: RuleContext): void {
  if (ctx.status.has(playerId, LES_MAINS_VANISHED_USED)) return;
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const completed = ctx.cards.playerCompletedSets(FAMILIES, playerId);
  const ranked = LES_MAINS_FAMILIES.filter(
    (family) => !completed.includes(family),
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
  ctx.cards.completeSet(FAMILIES, playerId, selected.family, {
    allowIncomplete: true,
  });
  ctx.status.add(playerId, LES_MAINS_VANISHED_USED, { scope: 'match' });
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
  if (!target || ownHand.length === 0) return;
  const stolenCard = ctx.cards.stealRandom<string>(HANDS, target.id, playerId);
  if (stolenCard == null) return;
  const ownCard = ctx.random.pick(ownHand);
  if (!ownCard) return;
  ctx.cards.transfer(HANDS, playerId, target.id, ownCard);
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
  ctx.cards.shuffleHands(HANDS, [playerId, target.id]);
}

function passKnowledge(playerId: number, ctx: RuleContext): void {
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
  ctx.cards.transfer(HANDS, selected.playerId, playerId, selected.cardId);
  completeFamily(playerId, selected.cardId, ctx);
}

function maybeFinish(ctx: RuleContext): void {
  const completedCounts = ctx.cards.completedSetCounts(FAMILIES);
  const total = Object.values(completedCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const noCardsRemain =
    ctx.cards.deckCount(DECK) === 0 && ctx.cards.discardCount(DECK) === 0;
  const handless = ctx.players
    .all()
    .some((player) => ctx.cards.hand(HANDS, player.id).length === 0);
  if (total < LES_MAINS_FAMILIES.length && !(noCardsRemain && handless)) return;
  const winnerIds = ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    { value: (playerId) => completedCounts[playerId] ?? 0 },
  );
  ctx.match.finish({ winners: winnerIds, reason: 'families-complete' });
}

export const LES_MAINS_EFFECTS = {
  'les-mains.exchange-random': defineEffect<
    LesMainsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) exchangeRandom(actorPlayerId, ctx);
    },
  }),
  'les-mains.complete-vanished': defineEffect<
    LesMainsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) completeVanished(actorPlayerId, ctx);
    },
  }),
  'les-mains.mix-hands': defineEffect<LesMainsState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) mixHands(actorPlayerId, ctx);
    },
  }),
  'les-mains.pass-knowledge': defineEffect<
    LesMainsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) passKnowledge(actorPlayerId, ctx);
    },
  }),
  'les-mains.log-special': defineEffect<LesMainsState, { cardId: string }>({
    input: gameInput.object({ cardId: gameInput.cardId() }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        ctx.events.message('les-mains.special.applied', {
          playerId: actorPlayerId,
          cardId: data.cardId,
        });
      }
    },
  }),
} as const;
