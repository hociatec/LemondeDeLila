import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  PANIER_EVENTS,
  PANIER_EXCHANGES,
  PANIER_PAWNS,
  PANIER_STANDS,
  PANIER_TILES,
  type PanierEventEffect,
  type PanierExchangeEffect,
} from './content';
import type { PanierState } from './state';

type RuleContext = GameRuleContext<PanierState>;
type TargetEffect = PanierEventEffect | PanierExchangeEffect;
const TRACK = 'market';
const MAX_DEPTH = 24;

export const roll = defineAction<PanierState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout la case du marché.',
  available: ({ state }) =>
    state.setupComplete && state.pending == null && state.winnerId == null,
  execute: ({ state, actor, ctx }) => {
    state.resolvingPlayerId = actor.id;
    const rollValue = ctx.dice.roll('main').total;
    ctx.history.add(`${actor.username} lance le dé : ${rollValue}.`);
    moveAndResolve(
      state,
      actor.id,
      rollValue * state.movementDirection,
      0,
      ctx,
    );
    finishResolution(state, ctx);
  },
});

export const PANIER_ACTIONS = { roll };

export function requestPawn(
  state: PanierState,
  actorId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const available = PANIER_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'panier.pawn',
    player: actorId,
    options: available.map((pawn) => pawn.id),
    label: (id) => available.find((pawn) => pawn.id === id)?.name ?? id,
  });
}

export function resolvePawn(
  state: PanierState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!PANIER_PAWNS.some((pawn) => pawn.id === pawnId))
    throw new Error('Pion Panier invalide');
  if (Object.values(state.pawnByPlayerId).includes(pawnId))
    throw new Error('Pion Panier déjà choisi');
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
    return;
  }
  state.setupComplete = true;
  ctx.transitionTo('playing');
  ctx.turn.to(state.starterId);
}

export function resolveDirection(
  state: PanierState,
  actorId: number,
  value: string,
  ctx: RuleContext,
): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'direction' || pending.actorId !== actorId)
    throw new Error('Choix de direction absent');
  state.pending = null;
  moveAndResolve(
    state,
    actorId,
    value === 'forward' ? pending.distance : -pending.distance,
    0,
    ctx,
  );
  finishResolution(state, ctx);
}

export function resolveQuiz(
  state: PanierState,
  actorId: number,
  answerIndex: number,
  ctx: RuleContext,
): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'quiz' || pending.actorId !== actorId)
    throw new Error('Quiz Panier absent');
  state.pending = null;
  const correct = ctx.quiz.check(
    'market-quiz',
    pending.questionId,
    answerIndex,
  );
  ctx.history.add(
    correct ? 'Bonne réponse : avancez de 2.' : 'Mauvaise réponse.',
  );
  if (correct) moveAndResolve(state, actorId, 2, 0, ctx);
  finishResolution(state, ctx);
}

export function resolveTarget(
  state: PanierState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'target' || pending.actorId !== actorId)
    throw new Error('Cible Panier absente');
  if (targetId === actorId || !ctx.players.get(targetId))
    throw new Error('Cible Panier invalide');
  state.pending = null;
  applyTargetEffect(state, actorId, targetId, pending.effect, ctx);
  finishResolution(state, ctx);
}

export function resolveTake(
  state: PanierState,
  actorId: number,
  card: string,
  ctx: RuleContext,
): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'take' || pending.actorId !== actorId)
    throw new Error('Choix de carte adverse absent');
  if (!pending.targetCards.includes(card))
    throw new Error('Carte adverse absente');
  const ownCards = state.inventories[actorId];
  if (ownCards.length === 0) {
    transferInventoryCard(state, pending.targetId, actorId, card);
    state.pending = null;
    finishResolution(state, ctx);
    return;
  }
  state.pending = {
    kind: 'give',
    actorId,
    targetId: pending.targetId,
    take: card,
    ownCards: [...ownCards],
  };
  ctx.choice.one({
    id: 'panier.give',
    player: actorId,
    options: ownCards,
  });
}

export function resolveGive(
  state: PanierState,
  actorId: number,
  card: string,
  ctx: RuleContext,
): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'give' || pending.actorId !== actorId)
    throw new Error('Choix de carte à donner absent');
  if (!pending.ownCards.includes(card))
    throw new Error('Carte à donner absente');
  transferInventoryCard(state, pending.targetId, actorId, pending.take);
  transferInventoryCard(state, actorId, pending.targetId, card);
  state.pending = null;
  finishResolution(state, ctx);
}

export function skipPanierPlayer(state: PanierState, ctx: RuleContext): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  ctx.history.add(`${player.username} passe son tour.`);
  ctx.turn.end();
}

export function restoreMovement(state: PanierState, ctx: RuleContext): void {
  state.movementDirection = 1;
  state.reverseOwnerId = null;
  ctx.turn.reverse();
}

function moveAndResolve(
  state: PanierState,
  playerId: number,
  distance: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.pending || state.winnerId != null) return;
  const before = position(playerId, ctx);
  const raw = before + distance;
  ctx.movement.move(TRACK, playerId, distance);
  if (distance > 0 && raw >= PANIER_TILES.length) state.laps[playerId] += 1;
  resolveTile(state, playerId, depth + 1, ctx);
}

function resolveTile(
  state: PanierState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const tile = PANIER_TILES[position(playerId, ctx)];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint « ${tile.label} ».`,
  );
  if (tile.type === 'start') checkVictory(state, playerId);
  else if (tile.type === 'stand')
    drawCourse(state, playerId, tile.standId, ctx);
  else if (tile.type === 'bonus_course')
    drawCourse(state, playerId, 'bonus', ctx);
  else if (tile.type === 'event') drawEvent(state, playerId, depth, ctx);
  else if (tile.type === 'exchange') drawExchange(state, playerId, ctx);
  else if (tile.type === 'quiz') requestQuiz(state, playerId, ctx);
  else if (tile.type === 'move_choice')
    requestDirection(state, playerId, tile.delta ?? 2, ctx);
  else if (tile.type === 'move') {
    const delta = tile.delta ?? -(1 + ctx.random.int(10));
    moveAndResolve(state, playerId, delta, depth, ctx);
  } else if (tile.type === 'skip') state.skipTurns[playerId] += tile.turns ?? 1;
  else if (tile.type === 'move_to_stand')
    moveToNearestStand(state, playerId, depth, ctx);
}

function drawCourse(
  state: PanierState,
  playerId: number,
  standId: string | undefined,
  ctx: RuleContext,
): void {
  const cards = PANIER_STANDS[standId ?? 'bonus'] ?? PANIER_STANDS.bonus;
  const card = ctx.random.pick(cards);
  if (!card) return;
  const basket = state.baskets[playerId];
  if (state.shoppingLists[playerId].includes(card) && !basket.includes(card)) {
    basket.push(card);
    ctx.history.add(`${card} rejoint le panier.`);
  } else {
    state.inventories[playerId].push(card);
    ctx.history.add(`${card} rejoint l’inventaire.`);
  }
}

function drawEvent(
  state: PanierState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const event =
    ctx.cards.drawOrRecycle<(typeof PANIER_EVENTS)[number]>('events');
  if (!event) return;
  ctx.cards.discard('events', event);
  state.lastEventId = event.id;
  ctx.history.add(`Événement : ${event.id}.`);
  applyEventEffect(state, playerId, event.effect, depth, ctx);
}

function applyEventEffect(
  state: PanierState,
  playerId: number,
  effect: PanierEventEffect,
  depth: number,
  ctx: RuleContext,
): void {
  if (effect.kind === 'move')
    moveAndResolve(state, playerId, effect.delta, depth, ctx);
  else if (effect.kind === 'draw') {
    const recipients = effect.everyone
      ? ctx.players.all().map((player) => player.id)
      : [playerId];
    for (const recipient of recipients)
      for (let count = 0; count < effect.count; count += 1)
        drawCourse(state, recipient, 'bonus', ctx);
  } else if (effect.kind === 'skip') state.skipTurns[playerId] += effect.turns;
  else if (effect.kind === 'extra-turn') ctx.turn.extra();
  else if (effect.kind === 'discard') {
    const recipients = effect.everyone
      ? ctx.players.all().map((player) => player.id)
      : [playerId];
    for (const recipient of recipients)
      discardRandom(state, recipient, effect.count, ctx);
  } else if (effect.kind === 'reverse') {
    state.movementDirection = -1;
    state.reverseOwnerId = playerId;
    ctx.turn.reverse();
  } else if (effect.kind === 'quiz') requestQuiz(state, playerId, ctx);
  else if (effect.kind === 'nearest-stand')
    moveToNearestStand(state, playerId, depth, ctx);
  else if (effect.kind === 'reveal') state.revealTurns[playerId] += 1;
  else requestTarget(state, playerId, effect, ctx);
}

function drawExchange(
  state: PanierState,
  playerId: number,
  ctx: RuleContext,
): void {
  const exchange =
    ctx.cards.drawOrRecycle<(typeof PANIER_EXCHANGES)[number]>('exchanges');
  if (!exchange) return;
  ctx.cards.discard('exchanges', exchange);
  state.lastExchangeId = exchange.id;
  ctx.history.add(`Échange : ${exchange.id}.`);
  if (exchange.effect === 'discard') discardRandom(state, playerId, 1, ctx);
  else requestTarget(state, playerId, exchange.effect, ctx);
}

function applyTargetEffect(
  state: PanierState,
  actorId: number,
  targetId: number,
  effect: TargetEffect,
  ctx: RuleContext,
): void {
  const kind = typeof effect === 'string' ? effect : effect.kind;
  if (kind === 'swap-inventories') {
    const own = state.inventories[actorId];
    state.inventories[actorId] = state.inventories[targetId];
    state.inventories[targetId] = own;
  } else if (kind === 'strategic-swap')
    requestTake(state, actorId, targetId, ctx);
  else if (kind === 'discard') discardRandom(state, targetId, 1, ctx);
  else if (kind === 'steal') stealRandom(state, actorId, targetId, ctx);
  else randomSwap(state, actorId, targetId, ctx);
}

function requestTarget(
  state: PanierState,
  actorId: number,
  effect: TargetEffect,
  ctx: RuleContext,
): void {
  const targets = ctx.players.all().filter((player) => player.id !== actorId);
  if (targets.length === 0) return;
  state.pending = { kind: 'target', actorId, effect };
  ctx.choice.one({
    id: 'panier.target',
    player: actorId,
    options: targets.map((player) => player.id),
    label: (id) => ctx.players.get(id)?.username ?? `Joueur ${id}`,
  });
}

function requestTake(
  state: PanierState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const targetCards = state.inventories[targetId];
  if (targetCards.length === 0) return;
  state.pending = {
    kind: 'take',
    actorId,
    targetId,
    targetCards: [...targetCards],
  };
  ctx.choice.one({ id: 'panier.take', player: actorId, options: targetCards });
}

function requestQuiz(
  state: PanierState,
  playerId: number,
  ctx: RuleContext,
): void {
  const question = ctx.quiz.next('market-quiz');
  if (!question) return;
  state.pending = { kind: 'quiz', actorId: playerId, questionId: question.id };
  ctx.choice.one({
    id: 'panier.quiz',
    player: playerId,
    options: question.choices.map((_, index) => index),
    label: (index) => question.choices[index] ?? String(index),
  });
  ctx.history.add(question.prompt);
}

function requestDirection(
  state: PanierState,
  playerId: number,
  distance: number,
  ctx: RuleContext,
): void {
  state.pending = { kind: 'direction', actorId: playerId, distance };
  ctx.choice.one({
    id: 'panier.direction',
    player: playerId,
    options: ['forward', 'backward'],
  });
}

function moveToNearestStand(
  state: PanierState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  for (let distance = 1; distance < PANIER_TILES.length; distance += 1) {
    const index = (current + distance) % PANIER_TILES.length;
    if (PANIER_TILES[index].type === 'stand') {
      moveAndResolve(state, playerId, distance, depth, ctx);
      return;
    }
  }
}

function stealRandom(
  state: PanierState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const card = ctx.random.pick(state.inventories[targetId]);
  if (card) transferInventoryCard(state, targetId, actorId, card);
}

function randomSwap(
  state: PanierState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const own = ctx.random.pick(state.inventories[actorId]);
  const other = ctx.random.pick(state.inventories[targetId]);
  if (own) transferInventoryCard(state, actorId, targetId, own);
  if (other) transferInventoryCard(state, targetId, actorId, other);
}

function transferInventoryCard(
  state: PanierState,
  fromId: number,
  toId: number,
  card: string,
): void {
  const index = state.inventories[fromId].indexOf(card);
  if (index < 0) return;
  state.inventories[fromId].splice(index, 1);
  state.inventories[toId].push(card);
}

function discardRandom(
  state: PanierState,
  playerId: number,
  count: number,
  ctx: RuleContext,
): void {
  for (let index = 0; index < count; index += 1) {
    const card = ctx.random.pick(state.inventories[playerId]);
    if (!card) return;
    state.inventories[playerId].splice(
      state.inventories[playerId].indexOf(card),
      1,
    );
  }
}

function checkVictory(state: PanierState, playerId: number): void {
  const complete = state.shoppingLists[playerId].every((item) =>
    state.baskets[playerId].includes(item),
  );
  if (complete && state.laps[playerId] > 0) state.winnerId = playerId;
}

function finishResolution(state: PanierState, ctx: RuleContext): void {
  if (state.pending || state.winnerId != null) return;
  const playerId = state.resolvingPlayerId;
  if (playerId != null && state.revealTurns[playerId] > 0)
    state.revealTurns[playerId] -= 1;
  state.resolvingPlayerId = null;
  ctx.turn.end();
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}
