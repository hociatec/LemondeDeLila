import {
  defineAction,
  gameEffects,
  gameInput,
} from '../../../core/application/public-api';
import type {
  GameContext,
  PlayerMap,
} from '../../../core/application/public-api';
import { LA_GRANDE_MINE_CARD_BY_ID, type LaGrandeMineCard } from './content';
import type { GrandeMineState, MineDomain } from './state';

const DECK = 'mine';
const HANDS = 'players';
const HAND_LIMIT = 5;
export const MINE_DOMAINS = 'mine-domains';
export const MINE_DISCARD_NEXT_DRAW = 'mine.discard-next-draw';
type RuleContext = GameContext<GrandeMineState>;

export const playCard = defineAction<GrandeMineState, { cardId: string }>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
  }),
  documentation: 'Pose une carte de domaine ou résout son effet immédiat.',
  validate: ({ actor, input, ctx }) =>
    enumeratePlays(actor.id, ctx).some(
      (candidate) => candidate.cardId === input.cardId,
    ),
  enumerate: ({ actor, ctx }) => enumeratePlays(actor.id, ctx),
  execute: ({ actor, input, ctx }) => {
    const card = LA_GRANDE_MINE_CARD_BY_ID[input.cardId];
    ctx.cards.take(HANDS, actor.id, input.cardId);
    if (card.category === 'tresor' || card.category === 'objet')
      ctx.inventory.add(MINE_DOMAINS, actor.id, card.id);
    else {
      ctx.cards.discard(DECK, card.id);
      resolveImmediate(card, ctx);
    }
    trimHand(actor.id, ctx);
    if (card.category === 'tresor' || card.category === 'objet') {
      ctx.turn.complete();
    } else {
      ctx.effects.schedule(gameEffects.completeTurn());
    }
  },
});

export const pass = defineAction<GrandeMineState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Conserve son domaine et termine le tour.',
  execute: ({ actor, ctx }) => {
    trimHand(actor.id, ctx);
    ctx.events.message('game.player.passed', { playerId: actor.id });
    ctx.turn.complete();
  },
});

export const GRANDE_MINE_ACTIONS = { play_card: playCard, pass };

export function enumeratePlays(
  playerId: number,
  ctx: RuleContext,
): Array<{ cardId: string }> {
  return ctx.cards
    .hand<string>(HANDS, playerId)
    .filter((cardId) => LA_GRANDE_MINE_CARD_BY_ID[cardId] != null)
    .map((cardId) => ({ cardId }));
}

export function drawAtTurnStart(ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  ctx.effects.recordSource({
    playerId: current.id,
    deckId: DECK,
    ...(cardId ? { cardId } : {}),
  });
  if (!cardId) {
    finishMine(ctx);
    return;
  }
  if (ctx.status.consume(current.id, MINE_DISCARD_NEXT_DRAW)) {
    ctx.cards.discard(DECK, cardId);
    return;
  }
  const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
  ctx.events.message('game.card.drawn', {
    playerId: current.id,
    cardId,
    deckId: DECK,
  });
  if (card.category === 'tresor' || card.category === 'objet') {
    ctx.cards.give(HANDS, current.id, cardId);
  } else {
    ctx.cards.discard(DECK, cardId);
    resolveImmediate(card, ctx);
  }
}

export function scoreDomain(domain: MineDomain): number {
  return [...domain.treasures, ...domain.objects].reduce(
    (score, cardId) => score + (LA_GRANDE_MINE_CARD_BY_ID[cardId]?.points ?? 0),
    0,
  );
}

function resolveImmediate(card: LaGrandeMineCard, ctx: RuleContext): void {
  ctx.effects.schedule(
    gameEffects.custom('mine.log-card', { cardId: card.id }),
    ...card.effects,
  );
}

export function drawPassive(playerId: number, ctx: RuleContext): void {
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  if (!cardId) return;
  const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
  if (card.category === 'tresor' || card.category === 'objet') {
    ctx.cards.give(HANDS, playerId, cardId);
  } else ctx.cards.discard(DECK, cardId);
}

export function recoverDiscard(playerId: number, ctx: RuleContext): void {
  const candidate = ctx.cards.discardPile<string>(DECK).find((cardId) => {
    const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    return card?.category === 'tresor' || card?.category === 'objet';
  });
  if (!candidate) return;
  ctx.cards.takeDiscard(DECK, candidate);
  ctx.cards.give(HANDS, playerId, candidate);
}

export function removeRandomDomainCard(
  playerId: number,
  ctx: RuleContext,
): void {
  const domain = mineDomain(playerId, ctx);
  const cardId = ctx.random.pick([...domain.treasures, ...domain.objects]);
  if (!cardId) {
    discardRandomHand(playerId, ctx);
    return;
  }
  ctx.inventory.remove(MINE_DOMAINS, playerId, cardId);
  ctx.cards.discard(DECK, cardId);
}

export function removeRandomTreasure(playerId: number, ctx: RuleContext): void {
  const domain = mineDomain(playerId, ctx);
  const cardId = ctx.random.pick(domain.treasures);
  if (!cardId) return;
  ctx.inventory.remove(MINE_DOMAINS, playerId, cardId);
  ctx.cards.discard(DECK, cardId);
}

export function discardRandomHand(playerId: number, ctx: RuleContext): void {
  ctx.cards.discardRandom(HANDS, DECK, playerId);
}

export function giveRandomToNext(playerId: number, ctx: RuleContext): void {
  const targetId = ctx.players.after(playerId)?.id ?? null;
  if (targetId != null) giveRandom(playerId, targetId, ctx);
}

export function giveRandomToOpponent(playerId: number, ctx: RuleContext): void {
  const targetId = randomOpponent(playerId, ctx);
  if (targetId != null) giveRandom(playerId, targetId, ctx);
}

function giveRandom(fromId: number, toId: number, ctx: RuleContext): void {
  const cardId = ctx.random.pick(ctx.cards.hand<string>(HANDS, fromId));
  if (!cardId) return;
  ctx.cards.transfer(HANDS, fromId, toId, cardId);
}

function randomOpponent(playerId: number, ctx: RuleContext): number | null {
  return ctx.random.pick(
    ctx.players
      .all()
      .filter((player) => player.id !== playerId)
      .map((player) => player.id),
  );
}

export function trimHand(playerId: number, ctx: RuleContext): void {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  while (hand.length > HAND_LIMIT) {
    const cardId = hand.at(-1);
    if (!cardId) return;
    ctx.cards.play(HANDS, DECK, playerId, cardId);
  }
}

export function finishMine(ctx: RuleContext): void {
  const winnerIds = ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    { value: (playerId) => scoreDomain(mineDomain(playerId, ctx)) },
  );
  ctx.match.finish({ winners: winnerIds, reason: 'mine-collapsed' });
}

export function mineDomains(ctx: RuleContext): PlayerMap<MineDomain> {
  return ctx.players.byId((player) => mineDomain(player.id, ctx));
}

function mineDomain(playerId: number, ctx: RuleContext): MineDomain {
  const cards = ctx.inventory.items(MINE_DOMAINS, playerId);
  return {
    treasures: cards.filter(
      (cardId) => LA_GRANDE_MINE_CARD_BY_ID[cardId]?.category === 'tresor',
    ),
    objects: cards.filter(
      (cardId) => LA_GRANDE_MINE_CARD_BY_ID[cardId]?.category === 'objet',
    ),
  };
}
