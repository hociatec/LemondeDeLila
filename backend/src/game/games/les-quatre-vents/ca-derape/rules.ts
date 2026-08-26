import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { CA_DERAPE_TILES, type CaCard } from './content';
import type { CaDerapeState, CaPendingKind } from './state';

type RuleContext = GameRuleContext<CaDerapeState>;
const TRACK = 'derape';
const DECK = 'situations';
const FINISH = CA_DERAPE_TILES.length - 1;
const MAX_DEPTH = 16;

export const roll = defineAction<CaDerapeState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout les cartes Situation en chaîne.',
  execute: ({ state, actor, ctx }) => {
    const mirroredFrom = state.mirrorNextRollFrom[actor.id];
    let value =
      mirroredFrom == null ? 0 : (state.lastRollByPlayer[mirroredFrom] ?? 0);
    if (value <= 0) value = ctx.dice.roll('main').total;
    state.mirrorNextRollFrom[actor.id] = null;
    if (state.doubleNextRoll[actor.id]) {
      value *= 2;
      state.doubleNextRoll[actor.id] = false;
    }
    state.lastRollByPlayer[actor.id] = value;
    let delta = value + (state.nextPlayerDelta ?? 0);
    state.nextPlayerDelta = null;
    if (state.doubleNextMove[actor.id]) {
      delta *= 2;
      state.doubleNextMove[actor.id] = false;
    }
    incrementIdleCounters(state, actor.id, delta);
    movePlayer(state, actor.id, delta, 0, true, ctx);
    ctx.history.add(`${actor.username} lance le dé : ${value}.`);
    completeResolution(state, actor.id, ctx);
  },
});

export const CA_DERAPE_ACTIONS = { roll };

export function resolveChoice(
  state: CaDerapeState,
  kind: CaPendingKind,
  value: number,
  ctx: RuleContext,
): void {
  if (state.pendingKind !== kind || state.pendingActorId == null) {
    throw new Error('Choix Ça Dérape inattendu');
  }
  const actorId = state.pendingActorId;
  const playerIds = ctx.players.all().map((player) => player.id);
  if (kind === 'swap') {
    requireOtherPlayer(value, actorId, playerIds);
    const actorPosition = position(actorId, ctx);
    const targetPosition = position(value, ctx);
    moveTo(actorId, targetPosition, ctx);
    moveTo(value, actorPosition, ctx);
  } else if (kind === 'next-player') {
    requireOtherPlayer(value, actorId, playerIds);
  } else if (kind === 'next-delta') {
    if (value !== -1 && value !== 1) throw new Error('Delta invalide');
    state.nextPlayerDelta = value;
  } else {
    requireOtherPlayer(value, actorId, playerIds);
    state.mirrorNextRollFrom[actorId] = value;
  }
  state.pendingKind = null;
  state.pendingActorId = null;
  if (kind === 'next-player') ctx.turn.to(value);
  else completeResolution(state, actorId, ctx);
}

export function skipCaPlayer(state: CaDerapeState, ctx: RuleContext): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  ctx.history.add(`${player.username} passe son tour.`);
  ctx.turn.end();
}

function resolveLanding(
  state: CaDerapeState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.winnerId != null) return;
  const current = position(playerId, ctx);
  const tile = CA_DERAPE_TILES[current];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint « ${tile.label} ».`,
  );
  if (current >= FINISH) {
    state.winnerId = playerId;
    return;
  }
  if (tile.isNeutral) return;
  const card = drawCard(ctx);
  if (!card) return;
  ctx.history.add(`${card.title} — ${card.text}`);
  applyCard(state, playerId, card, depth + 1, ctx);
}

function applyCard(
  state: CaDerapeState,
  actorId: number,
  card: CaCard,
  depth: number,
  ctx: RuleContext,
): void {
  if (card.kind === 'move') {
    applyPenaltyAwareMove(state, actorId, card.moveDelta ?? 0, depth, ctx);
  } else if (card.kind === 'skip') {
    if (!consumePenaltyShield(state, actorId)) state.skipTurns[actorId] += 1;
  } else if (card.kind === 'special') {
    applySpecial(state, actorId, card, depth, ctx);
  } else if (card.kind === 'global') {
    applyGlobal(state, card.id, ctx);
  } else if (card.kind === 'conditional') {
    applyConditional(state, actorId, card.id, depth, ctx);
  } else if (card.kind === 'rule') {
    applyRule(state, actorId, card.id, depth, ctx);
  }
  markWinnerIfReached(state, ctx);
}

function applySpecial(
  state: CaDerapeState,
  actorId: number,
  card: CaCard,
  depth: number,
  ctx: RuleContext,
): void {
  if (card.id === 33) {
    const lead = Math.max(
      ...ctx.players
        .all()
        .filter((player) => player.id !== actorId)
        .map((player) => position(player.id, ctx)),
    );
    moveTo(actorId, Math.min(FINISH, lead + 1), ctx);
  } else if (card.id === 34) {
    movePlayer(state, actorId, 4, depth, true, ctx);
    state.ignoreNextPenalty[actorId] = true;
  } else if (card.id === 35) {
    const ahead = ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== actorId &&
          position(player.id, ctx) > position(actorId, ctx),
      )
      .sort(
        (left, right) => position(left.id, ctx) - position(right.id, ctx),
      )[0];
    if (ahead) {
      moveTo(actorId, Math.min(FINISH, position(ahead.id, ctx) + 1), ctx);
      moveTo(ahead.id, Math.max(0, position(ahead.id, ctx) - 1), ctx);
    }
  } else if (card.id === 36) {
    const current = position(actorId, ctx);
    const next =
      Array.from(
        { length: FINISH - current },
        (_entry, index) => current + index + 1,
      ).find((candidate) => (candidate + 1) % 5 === 0) ?? FINISH;
    moveTo(actorId, next, ctx);
  } else if (card.id === 37) {
    movePlayer(state, actorId, card.moveDelta ?? 3, depth, true, ctx);
    state.extraTurn = true;
  } else if (card.id === 38) {
    movePlayer(state, actorId, card.moveDelta ?? 2, depth, true, ctx);
    if (state.winnerId == null)
      requestPlayerChoice(state, actorId, 'swap', ctx);
  }
}

function applyGlobal(
  state: CaDerapeState,
  cardId: number,
  ctx: RuleContext,
): void {
  const ids = ctx.players.all().map((player) => player.id);
  if (cardId === 41)
    assignPositions(
      ids,
      ctx.random.shuffle(ids.map((id) => position(id, ctx))),
      ctx,
    );
  else if (cardId === 42) {
    const ranked = [...ids].sort((a, b) => position(a, ctx) - position(b, ctx));
    assignPositions(
      ranked,
      ranked.map((id) => position(id, ctx)).reverse(),
      ctx,
    );
  } else if (cardId === 43 || cardId === 47) {
    for (const id of ids) state.skipTurns[id] += 1;
  } else if (cardId === 44 || cardId === 48) moveAll(ids, 1, ctx);
  else if (cardId === 45) moveAll(ids, -2, ctx);
  else if (cardId === 49) {
    const ranked = [...ids].sort((a, b) => position(b, ctx) - position(a, ctx));
    const values = ranked.map((id) => position(id, ctx));
    assignPositions(
      ranked,
      values.map((_value, index) => values[(index + 1) % values.length]),
      ctx,
    );
  } else if (cardId === 50) {
    for (const id of ids)
      moveTo(
        id,
        Math.min(FINISH, position(id, ctx) + ctx.random.int(6) + 1),
        ctx,
      );
  }
}

function applyConditional(
  state: CaDerapeState,
  actorId: number,
  cardId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const ids = ctx.players.all().map((player) => player.id);
  const ranked = [...ids].sort((a, b) => position(a, ctx) - position(b, ctx));
  if (cardId === 51)
    applyPenaltyAwareMove(
      state,
      actorId,
      actorId === ranked.at(-1) ? -2 : 2,
      depth,
      ctx,
    );
  else if (cardId === 52 && actorId === ranked[0])
    movePlayer(state, actorId, 3, depth, true, ctx);
  else if (cardId === 53 && state.lastMoveDelta[actorId] < 0)
    movePlayer(state, actorId, 3, depth, true, ctx);
  else if (cardId === 54 && state.skipTurns[actorId] > 0)
    state.skipTurns[actorId] -= 1;
  else if (cardId === 55)
    applyPenaltyAwareMove(
      state,
      actorId,
      (position(actorId, ctx) + 1) % 5 === 0 ? 4 : -1,
      depth,
      ctx,
    );
  else if (cardId === 56 && state.turnsSinceMoved[actorId] >= 2)
    movePlayer(state, actorId, 5, depth, true, ctx);
  else if (cardId === 57) {
    const other = ids.find(
      (id) => id !== actorId && position(id, ctx) === position(actorId, ctx),
    );
    if (other != null) {
      moveTo(actorId, Math.min(FINISH, position(actorId, ctx) + 2), ctx);
      moveTo(other, Math.min(FINISH, position(other, ctx) + 2), ctx);
    }
  } else if (cardId === 58) state.extraTurn = true;
  else if (cardId === 59) {
    const ahead = ranked[ranked.indexOf(actorId) + 1];
    if (ahead != null && position(ahead, ctx) === position(actorId, ctx) + 1)
      moveTo(actorId, position(ahead, ctx), ctx);
  } else if (cardId === 60 && state.lastMoveDelta[actorId] === 1)
    movePlayer(state, actorId, 1, depth, true, ctx);
}

function applyRule(
  state: CaDerapeState,
  actorId: number,
  cardId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (cardId === 61)
    movePlayer(
      state,
      actorId,
      ctx.random.int(6) + ctx.random.int(6) + 2,
      depth,
      true,
      ctx,
    );
  else if (cardId === 62) {
    const extra = drawCard(ctx);
    if (extra) applyCard(state, actorId, extra, depth + 1, ctx);
  } else if (cardId === 63) state.doubleNextMove[actorId] = true;
  else if (cardId === 64) applyPenaltyAwareMove(state, actorId, -1, depth, ctx);
  else if (cardId === 65) state.ignoreNextPenalty[actorId] = true;
  else if (cardId === 66) movePlayer(state, actorId, 2, depth, true, ctx);
  else if (cardId === 67)
    requestPlayerChoice(state, actorId, 'next-player', ctx);
  else if (cardId === 68) requestDeltaChoice(state, actorId, ctx);
  else if (cardId === 69) state.doubleNextRoll[actorId] = true;
  else if (cardId === 70) requestPlayerChoice(state, actorId, 'mirror', ctx);
}

function requestPlayerChoice(
  state: CaDerapeState,
  actorId: number,
  kind: 'swap' | 'next-player' | 'mirror',
  ctx: RuleContext,
): void {
  if (state.pendingKind != null) return;
  state.pendingKind = kind;
  state.pendingActorId = actorId;
  const players = ctx.players.all().filter((player) => player.id !== actorId);
  ctx.choice.one({
    id: `ca-derape.${kind}`,
    player: actorId,
    options: players.map((player) => player.id),
    label: (id) => ctx.players.get(id)?.username ?? `Joueur ${id}`,
  });
}

function requestDeltaChoice(
  state: CaDerapeState,
  actorId: number,
  ctx: RuleContext,
): void {
  state.pendingKind = 'next-delta';
  state.pendingActorId = actorId;
  ctx.choice.one({
    id: 'ca-derape.next-delta',
    player: actorId,
    options: [1, -1],
    label: (value) => (value > 0 ? 'Avancer de 1' : 'Reculer de 1'),
  });
}

function applyPenaltyAwareMove(
  state: CaDerapeState,
  actorId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (delta < 0 && consumePenaltyShield(state, actorId)) return;
  movePlayer(state, actorId, delta, depth, true, ctx);
}

function movePlayer(
  state: CaDerapeState,
  playerId: number,
  delta: number,
  depth: number,
  resolve: boolean,
  ctx: RuleContext,
): void {
  const target = Math.min(FINISH, Math.max(0, position(playerId, ctx) + delta));
  moveTo(playerId, target, ctx);
  state.lastMoveDelta[playerId] = delta;
  state.turnsSinceMoved[playerId] =
    delta === 0 ? state.turnsSinceMoved[playerId] : 0;
  if (resolve) resolveLanding(state, playerId, depth + 1, ctx);
}

function completeResolution(
  state: CaDerapeState,
  actorId: number,
  ctx: RuleContext,
): void {
  if (state.winnerId != null || state.pendingKind != null) return;
  if (state.extraTurn) state.extraTurn = false;
  else ctx.turn.end();
}

function consumePenaltyShield(state: CaDerapeState, actorId: number): boolean {
  if (!state.ignoreNextPenalty[actorId]) return false;
  state.ignoreNextPenalty[actorId] = false;
  return true;
}

function incrementIdleCounters(
  state: CaDerapeState,
  actorId: number,
  delta: number,
): void {
  for (const id of Object.keys(state.turnsSinceMoved).map(Number))
    state.turnsSinceMoved[id] += 1;
  if (delta !== 0) state.turnsSinceMoved[actorId] = 0;
}

function markWinnerIfReached(state: CaDerapeState, ctx: RuleContext): void {
  const winner = ctx.players
    .all()
    .find((player) => position(player.id, ctx) >= FINISH);
  if (winner) state.winnerId = winner.id;
}

function drawCard(ctx: RuleContext): CaCard | null {
  const card = ctx.cards.drawOrRecycle<CaCard>(DECK);
  if (card) ctx.cards.discard(DECK, card);
  return card;
}

function moveAll(ids: number[], delta: number, ctx: RuleContext): void {
  for (const id of ids)
    moveTo(id, Math.min(FINISH, Math.max(0, position(id, ctx) + delta)), ctx);
}

function assignPositions(
  ids: number[],
  values: number[],
  ctx: RuleContext,
): void {
  ids.forEach((id, index) => moveTo(id, values[index] ?? 0, ctx));
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function moveTo(playerId: number, target: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}

function requireOtherPlayer(
  value: number,
  actorId: number,
  ids: number[],
): void {
  if (value === actorId || !ids.includes(value))
    throw new Error('Joueur choisi invalide');
}
