import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  MINUIT_PAWNS,
  MINUIT_TILES,
  type MinuitCard,
  type MinuitCardEffect,
} from './content';
import type { MinuitState } from './state';

type RuleContext = GameRuleContext<MinuitState>;
const TRACK = 'minuit';
const DECK = 'noel';
const FINISH = MINUIT_TILES.length - 1;
const MAX_DEPTH = 24;

export const roll = defineAction<MinuitState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Lance le dé ou applique la pioche forcée, puis résout la case.',
  available: ({ state }) => state.setupComplete,
  execute: ({ state, actor, ctx }) => {
    if (state.forceDrawNextTurn[actor.id]) {
      state.forceDrawNextTurn[actor.id] = false;
      drawAndApply(state, actor.id, 0, ctx);
    } else {
      const value = ctx.dice.roll('main').total;
      ctx.history.add(`${actor.username} lance le dé : ${value}.`);
      moveAndLand(state, actor.id, value, 0, ctx);
    }
    completeTurn(state, actor.id, ctx);
  },
});

export const MINUIT_ACTIONS = { roll };

export function resolvePawn(
  state: MinuitState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!MINUIT_PAWNS.some((pawn) => pawn.id === pawnId)) {
    throw new Error('Pion Minuit invalide');
  }
  if (Object.values(state.pawnByPlayerId).includes(pawnId)) {
    throw new Error('Pion déjà choisi');
  }
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
  } else {
    state.setupComplete = true;
    ctx.transitionTo('playing');
    ctx.turn.to(state.starterId);
  }
}

export function requestPawn(
  state: MinuitState,
  actorId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const available = MINUIT_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'minuit.pawn',
    player: actorId,
    options: available.map((pawn) => pawn.id),
    label: (id) => available.find((pawn) => pawn.id === id)?.name ?? id,
  });
}

export function resolvePending(
  state: MinuitState,
  value: number,
  ctx: RuleContext,
): void {
  const pending = state.pendingResolution;
  if (!pending) throw new Error('Choix Minuit absent');
  state.pendingResolution = null;
  if (pending.kind === 'quiz') {
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value >= pending.choices.length
    ) {
      throw new Error('Réponse Minuit invalide');
    }
    const correct = pending.anyCorrect || value === pending.correctIndex;
    moveAndLand(
      state,
      pending.actorId,
      correct ? pending.successDelta : pending.failureDelta,
      0,
      ctx,
    );
  } else if (pending.kind === 'swap') {
    if (value !== 0) {
      requireTarget(value, pending.actorId, ctx);
      swapPositions(pending.actorId, value, ctx);
    }
  } else {
    requireTarget(value, pending.actorId, ctx);
    moveDirect(value, 1, ctx);
    moveAndLand(state, pending.actorId, 2, 0, ctx);
  }
  completeTurn(state, pending.actorId, ctx);
}

export function skipMinuitPlayer(state: MinuitState, ctx: RuleContext): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  ctx.history.add(`${player.username} passe son tour.`);
  ctx.turn.end();
}

function moveAndLand(
  state: MinuitState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.winnerId != null) return;
  const target = bounce(position(playerId, ctx) + delta);
  moveTo(playerId, target, ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function resolveLanding(
  state: MinuitState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.pendingResolution || state.winnerId != null)
    return;
  let current = position(playerId, ctx);
  const occupied = ctx.players
    .all()
    .some(
      (player) =>
        player.id !== playerId && position(player.id, ctx) === current,
    );
  if (occupied) {
    moveTo(playerId, Math.max(0, current - 1), ctx);
    current = position(playerId, ctx);
  }
  const tile = MINUIT_TILES[current];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint « ${tile.title} ».`,
  );
  if (tile.type === 'finish') {
    state.winnerId = playerId;
  } else if (tile.type === 'move') {
    if (tile.delta < 0 && state.ignoreNextMalus[playerId]) {
      state.ignoreNextMalus[playerId] = false;
    } else moveAndLand(state, playerId, tile.delta, depth, ctx);
  } else if (tile.type === 'skip') {
    if (state.ignoreNextSkip[playerId]) state.ignoreNextSkip[playerId] = false;
    else state.skipTurns[playerId] += tile.skipTurns;
  } else if (tile.type === 'card') drawAndApply(state, playerId, depth, ctx);
}

function drawAndApply(
  state: MinuitState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.pendingResolution) return;
  const card = ctx.cards.drawOrRecycle<MinuitCard>(DECK);
  if (!card) return;
  ctx.cards.discard(DECK, card);
  ctx.history.add(`Carte Noël : ${card.title}.`);
  applyCard(state, playerId, card, depth + 1, ctx);
}

function applyCard(
  state: MinuitState,
  playerId: number,
  card: MinuitCard,
  depth: number,
  ctx: RuleContext,
): void {
  const effect = card.effect;
  if (effect.kind === 'quiz') {
    state.pendingResolution = {
      kind: 'quiz',
      actorId: playerId,
      cardId: card.id,
      prompt: effect.quiz.prompt,
      choices: [...effect.quiz.choices],
      correctIndex: effect.quiz.correctIndex,
      successDelta: effect.quiz.successDelta,
      failureDelta: effect.quiz.failureDelta,
      anyCorrect: effect.quiz.anyCorrect ?? false,
    };
    ctx.choice.one({
      id: 'minuit.resolve',
      player: playerId,
      options: effect.quiz.choices.map((_choice, index) => index),
      label: (index) => effect.quiz.choices[index],
    });
    return;
  }
  applyStandardEffect(state, playerId, effect, depth, ctx);
}

function applyStandardEffect(
  state: MinuitState,
  playerId: number,
  effect: MinuitCardEffect,
  depth: number,
  ctx: RuleContext,
): void {
  if (effect.kind === 'move')
    applyCardMove(state, playerId, effect.delta, depth, ctx);
  else if (effect.kind === 'roll')
    moveAndLand(state, playerId, ctx.dice.roll('main').total, depth, ctx);
  else if (effect.kind === 'shield-malus')
    state.ignoreNextMalus[playerId] = true;
  else if (effect.kind === 'next-card')
    moveToTypedTile(state, playerId, 'card', 1, depth, ctx);
  else if (effect.kind === 'replay') state.keepTurns[playerId] += 1;
  else if (effect.kind === 'gift') requestTarget(state, playerId, 'gift', ctx);
  else if (effect.kind === 'shield-skip') state.ignoreNextSkip[playerId] = true;
  else if (effect.kind === 'swap') requestTarget(state, playerId, 'swap', ctx);
  else if (effect.kind === 'skip') state.skipTurns[playerId] += effect.turns;
  else if (effect.kind === 'previous-card')
    moveToTypedTile(state, playerId, 'card', -1, depth, ctx);
  else if (effect.kind === 'force-draw')
    state.forceDrawNextTurn[playerId] = true;
  else if (effect.kind === 'swap-behind') swapWithBehind(playerId, ctx);
  else if (effect.kind === 'move-others') {
    for (const player of ctx.players.all())
      if (player.id !== playerId) moveDirect(player.id, effect.delta, ctx);
  } else moveToTypedTile(state, playerId, 'neutral', -1, depth, ctx);
}

function applyCardMove(
  state: MinuitState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (delta < 0 && state.ignoreNextMalus[playerId]) {
    state.ignoreNextMalus[playerId] = false;
    return;
  }
  moveAndLand(state, playerId, delta, depth, ctx);
}

function moveToTypedTile(
  state: MinuitState,
  playerId: number,
  type: 'card' | 'neutral',
  direction: 1 | -1,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const candidates = MINUIT_TILES.filter(
    (tile, index) =>
      tile.type === type &&
      (direction === 1 ? index > current : index < current),
  );
  const selected = direction === 1 ? candidates[0] : candidates.at(-1);
  if (!selected) return;
  moveTo(playerId, selected.n - 1, ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function requestTarget(
  state: MinuitState,
  actorId: number,
  kind: 'swap' | 'gift',
  ctx: RuleContext,
): void {
  state.pendingResolution = { kind, actorId };
  const targets = ctx.players.all().filter((player) => player.id !== actorId);
  const options =
    kind === 'swap'
      ? [...targets.map((player) => player.id), 0]
      : targets.map((player) => player.id);
  ctx.choice.one({
    id: 'minuit.resolve',
    player: actorId,
    options,
    label: (id) =>
      id === 0
        ? 'Refuser l’échange'
        : (ctx.players.get(id)?.username ?? `Joueur ${id}`),
  });
}

function swapWithBehind(actorId: number, ctx: RuleContext): void {
  const actorPosition = position(actorId, ctx);
  const behind = ctx.players
    .all()
    .filter(
      (player) =>
        player.id !== actorId && position(player.id, ctx) < actorPosition,
    )
    .sort((left, right) => position(right.id, ctx) - position(left.id, ctx))[0];
  if (behind) swapPositions(actorId, behind.id, ctx);
}

function completeTurn(
  state: MinuitState,
  actorId: number,
  ctx: RuleContext,
): void {
  if (state.winnerId != null || state.pendingResolution) return;
  if (state.keepTurns[actorId] > 0) state.keepTurns[actorId] -= 1;
  else ctx.turn.end();
}

function requireTarget(
  targetId: number,
  actorId: number,
  ctx: RuleContext,
): void {
  if (targetId === actorId || !ctx.players.get(targetId))
    throw new Error('Cible Minuit invalide');
}

function swapPositions(
  firstId: number,
  secondId: number,
  ctx: RuleContext,
): void {
  const first = position(firstId, ctx);
  const second = position(secondId, ctx);
  moveTo(firstId, second, ctx);
  moveTo(secondId, first, ctx);
}

function moveDirect(playerId: number, delta: number, ctx: RuleContext): void {
  moveTo(playerId, bounce(position(playerId, ctx) + delta), ctx);
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function moveTo(playerId: number, target: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}

function bounce(raw: number): number {
  if (raw < 0) return 0;
  return raw <= FINISH ? raw : Math.max(0, FINISH - (raw - FINISH));
}
