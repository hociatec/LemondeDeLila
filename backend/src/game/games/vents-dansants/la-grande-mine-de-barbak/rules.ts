import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { LA_GRANDE_MINE_CARD_BY_ID, type LaGrandeMineCard } from './content';
import type { GrandeMineState, MineDomain } from './state';

const DECK = 'mine';
const HANDS = 'players';
const HAND_LIMIT = 5;
type RuleContext = GameRuleContext<GrandeMineState>;

export const playCard = defineAction<
  GrandeMineState,
  { cardId: string; targetPlayerId?: number }
>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
  }),
  documentation: 'Pose une carte de domaine ou résout son effet immédiat.',
  availableInputs: ({ actor, ctx }) => enumeratePlays(actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    const card = LA_GRANDE_MINE_CARD_BY_ID[input.cardId];
    ctx.cards.take(HANDS, actor.id, input.cardId);
    if (card.category === 'tresor')
      state.domains[actor.id].treasures.push(card.id);
    else if (card.category === 'objet')
      state.domains[actor.id].objects.push(card.id);
    else {
      ctx.cards.discard(DECK, card.id);
      resolveImmediate(
        state,
        actor.id,
        card,
        input.targetPlayerId ?? null,
        ctx,
      );
    }
    trimHand(actor.id, ctx);
    if (!state.gameOver) endTurn(state, ctx);
  },
});

export const pass = defineAction<GrandeMineState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Conserve son domaine et termine le tour.',
  execute: ({ state, actor, ctx }) => {
    trimHand(actor.id, ctx);
    ctx.history.add(`${actor.username} passe son tour.`);
    endTurn(state, ctx);
  },
});

export const GRANDE_MINE_ACTIONS = { play_card: playCard, pass };

export function enumeratePlays(
  playerId: number,
  ctx: RuleContext,
): Array<{ cardId: string; targetPlayerId?: number }> {
  return ctx.cards.hand<string>(HANDS, playerId).flatMap((cardId) => {
    const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    if (!card) return [];
    if (card.category === 'monster' || card.id === 'barbak-event-20') {
      return ctx.players
        .all()
        .filter((player) => player.id !== playerId)
        .map((target) => ({ cardId, targetPlayerId: target.id }));
    }
    return [{ cardId }];
  });
}

export function drawAtTurnStart(
  state: GrandeMineState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.drawnPlayerId = current.id;
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  if (!cardId) {
    finishMine(state, ctx);
    return;
  }
  if (state.discardNextDraw[current.id]) {
    state.discardNextDraw[current.id] = false;
    ctx.cards.discard(DECK, cardId);
    return;
  }
  const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
  ctx.history.add(`${current.username} pioche ${card.name}.`);
  if (card.category === 'tresor' || card.category === 'objet') {
    ctx.cards.give(HANDS, current.id, cardId);
  } else {
    ctx.cards.discard(DECK, cardId);
    resolveImmediate(state, current.id, card, null, ctx);
  }
}

export function skipMinePlayer(state: GrandeMineState, ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  state.drawnPlayerId = null;
  ctx.history.add(`${current.username} saute son tour.`);
  ctx.turn.end();
}

export function scoreDomain(domain: MineDomain): number {
  return [...domain.treasures, ...domain.objects].reduce(
    (score, cardId) => score + (LA_GRANDE_MINE_CARD_BY_ID[cardId]?.points ?? 0),
    0,
  );
}

function resolveImmediate(
  state: GrandeMineState,
  playerId: number,
  card: LaGrandeMineCard,
  targetId: number | null,
  ctx: RuleContext,
): void {
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le nain'} déclenche ${card.name}.`,
  );
  if (card.category === 'monster')
    resolveMonster(state, playerId, targetId, card, ctx);
  else if (card.category === 'collapse')
    resolveCollapse(state, playerId, card.id, ctx);
  else if (card.category === 'event')
    resolveEvent(state, playerId, targetId, card.id, ctx);
}

function resolveMonster(
  state: GrandeMineState,
  playerId: number,
  targetId: number | null,
  card: LaGrandeMineCard,
  ctx: RuleContext,
): void {
  if (card.id === 'barbak-monster-3' || card.id === 'barbak-monster-7') {
    for (const player of ctx.players.all())
      removeRandomDomainCard(state, player.id, ctx);
    return;
  }
  const target =
    targetId ??
    ctx.random.pick(
      ctx.players
        .all()
        .filter((player) => player.id !== playerId)
        .map((player) => player.id),
    );
  if (target != null) removeRandomDomainCard(state, target, ctx);
}

function resolveCollapse(
  state: GrandeMineState,
  playerId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  if (cardId === 'barbak-collapse-1') {
    for (const player of ctx.players.all()) discardRandomHand(player.id, ctx);
  } else if (cardId === 'barbak-collapse-2') {
    for (const player of ctx.players.all()) {
      removeRandomTreasure(state, player.id, ctx);
      removeRandomTreasure(state, player.id, ctx);
    }
  } else {
    ctx.history.add(
      `${ctx.players.get(playerId)?.username ?? 'Un nain'} déclenche l’effondrement final.`,
    );
    finishMine(state, ctx);
  }
}

function resolveEvent(
  state: GrandeMineState,
  playerId: number,
  targetId: number | null,
  cardId: string,
  ctx: RuleContext,
): void {
  if (cardId === 'barbak-event-1') ctx.turn.extra();
  else if (cardId === 'barbak-event-2') discardRandomHand(playerId, ctx);
  else if (cardId === 'barbak-event-5') recoverDiscard(playerId, ctx);
  else if (cardId === 'barbak-event-8') {
    for (const player of ctx.players.all()) discardRandomHand(player.id, ctx);
  } else if (cardId === 'barbak-event-9') state.skipTurns[playerId] += 1;
  else if (cardId === 'barbak-event-10') giveRandomToNext(playerId, ctx);
  else if (cardId === 'barbak-event-11') {
    for (const player of ctx.players.all())
      removeRandomTreasure(state, player.id, ctx);
  } else if (cardId === 'barbak-event-13') {
    for (const player of ctx.players.all()) drawPassive(player.id, ctx);
  } else if (cardId === 'barbak-event-14') {
    drawPassive(playerId, ctx);
    drawPassive(playerId, ctx);
    giveRandomToOpponent(playerId, ctx);
  } else if (cardId === 'barbak-event-15')
    state.discardNextDraw[playerId] = true;
  else if (cardId === 'barbak-event-18') {
    drawPassive(playerId, ctx);
    drawPassive(playerId, ctx);
    drawPassive(playerId, ctx);
    trimHand(playerId, ctx);
  } else if (cardId === 'barbak-event-19') {
    const next = nextPlayerId(playerId, ctx);
    if (next != null) {
      ctx.turn.to(next);
      ctx.turn.extra();
      ctx.turn.to(playerId);
    }
  } else if (cardId === 'barbak-event-20') {
    const target = targetId ?? randomOpponent(playerId, ctx);
    if (target != null) discardRandomHand(target, ctx);
  } else if (cardId === 'barbak-event-24')
    removeRandomTreasure(state, playerId, ctx);
}

function drawPassive(playerId: number, ctx: RuleContext): void {
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  if (!cardId) return;
  const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
  if (card.category === 'tresor' || card.category === 'objet') {
    ctx.cards.give(HANDS, playerId, cardId);
  } else ctx.cards.discard(DECK, cardId);
}

function recoverDiscard(playerId: number, ctx: RuleContext): void {
  const candidate = ctx.cards.discardPile<string>(DECK).find((cardId) => {
    const card = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    return card?.category === 'tresor' || card?.category === 'objet';
  });
  if (!candidate) return;
  ctx.cards.takeDiscard(DECK, candidate);
  ctx.cards.give(HANDS, playerId, candidate);
}

function removeRandomDomainCard(
  state: GrandeMineState,
  playerId: number,
  ctx: RuleContext,
): void {
  const domain = state.domains[playerId];
  const cardId = ctx.random.pick([...domain.treasures, ...domain.objects]);
  if (!cardId) {
    discardRandomHand(playerId, ctx);
    return;
  }
  removeDomainCard(domain, cardId);
  ctx.cards.discard(DECK, cardId);
}

function removeRandomTreasure(
  state: GrandeMineState,
  playerId: number,
  ctx: RuleContext,
): void {
  const domain = state.domains[playerId];
  const cardId = ctx.random.pick(domain.treasures);
  if (!cardId) return;
  removeDomainCard(domain, cardId);
  ctx.cards.discard(DECK, cardId);
}

function removeDomainCard(domain: MineDomain, cardId: string): void {
  const treasure = domain.treasures.indexOf(cardId);
  if (treasure >= 0) domain.treasures.splice(treasure, 1);
  const object = domain.objects.indexOf(cardId);
  if (object >= 0) domain.objects.splice(object, 1);
}

function discardRandomHand(playerId: number, ctx: RuleContext): void {
  const cardId = ctx.random.pick(ctx.cards.hand<string>(HANDS, playerId));
  if (cardId) ctx.cards.play(HANDS, DECK, playerId, cardId);
}

function giveRandomToNext(playerId: number, ctx: RuleContext): void {
  const targetId = nextPlayerId(playerId, ctx);
  if (targetId != null) giveRandom(playerId, targetId, ctx);
}

function giveRandomToOpponent(playerId: number, ctx: RuleContext): void {
  const targetId = randomOpponent(playerId, ctx);
  if (targetId != null) giveRandom(playerId, targetId, ctx);
}

function giveRandom(fromId: number, toId: number, ctx: RuleContext): void {
  const cardId = ctx.random.pick(ctx.cards.hand<string>(HANDS, fromId));
  if (!cardId) return;
  ctx.cards.take(HANDS, fromId, cardId);
  ctx.cards.give(HANDS, toId, cardId);
}

function nextPlayerId(playerId: number, ctx: RuleContext): number | null {
  const players = ctx.players.all();
  const index = players.findIndex((player) => player.id === playerId);
  return players[(index + 1) % players.length]?.id ?? null;
}

function randomOpponent(playerId: number, ctx: RuleContext): number | null {
  return ctx.random.pick(
    ctx.players
      .all()
      .filter((player) => player.id !== playerId)
      .map((player) => player.id),
  );
}

function trimHand(playerId: number, ctx: RuleContext): void {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  while (hand.length > HAND_LIMIT) {
    const cardId = hand.at(-1);
    if (!cardId) return;
    ctx.cards.play(HANDS, DECK, playerId, cardId);
  }
}

function finishMine(state: GrandeMineState, ctx: RuleContext): void {
  const scores = ctx.players.all().map((player) => ({
    playerId: player.id,
    score: scoreDomain(state.domains[player.id]),
  }));
  const best = Math.max(...scores.map((entry) => entry.score));
  state.winnerIds = scores
    .filter((entry) => entry.score === best)
    .map((entry) => entry.playerId);
  state.gameOver = true;
}

function endTurn(state: GrandeMineState, ctx: RuleContext): void {
  state.drawnPlayerId = null;
  ctx.turn.end();
}
