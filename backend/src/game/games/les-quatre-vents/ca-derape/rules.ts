import {
  commonStatuses,
  defineAction,
  drawEvent,
  gameEffects,
  gameInput,
  positionOf,
  rejectRule,
} from '../../../core/application/public-api';
import type {
  GameContext,
  PlayerMap,
} from '../../../core/application/public-api';
import {
  CA_DERAPE_TILES,
  type CaCard,
  type CaConditionalEffect,
  type CaGlobalEffect,
  type CaRuleEffect,
  type CaSpecialEffect,
} from './content';
import type { CaDerapeState } from './state';

type RuleContext = GameContext<CaDerapeState>;
export const TRACK = 'derape';
const DECK = 'situations';
const FINISH = CA_DERAPE_TILES.length - 1;
const MAX_DEPTH = 16;
export const CA_LAST_ROLL = 'ca-derape.last-roll';
export const CA_LAST_MOVE = 'ca-derape.last-move';
export const CA_IDLE_TURNS = 'ca-derape.idle-turns';
export const CA_MIRROR_ROLL = 'ca-derape.mirror-roll';
export const CA_NEXT_PLAYER_DELTA = 'ca-derape.next-player-delta';

export const roll = defineAction<CaDerapeState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout les cartes Situation en chaîne.',
  execute: ({ state, actor, ctx }) => {
    const mirroredFrom = mirrorSource(actor.id, ctx);
    let value =
      mirroredFrom == null ? 0 : ctx.resources.get(mirroredFrom, CA_LAST_ROLL);
    if (value <= 0) value = ctx.dice.roll('main').total;
    ctx.status.remove(actor.id, CA_MIRROR_ROLL);
    if (ctx.status.consume(actor.id, commonStatuses.doubleRoll)) {
      value *= 2;
    }
    ctx.resources.set(actor.id, CA_LAST_ROLL, value);
    let delta = value + ctx.counters.get(CA_NEXT_PLAYER_DELTA);
    ctx.counters.set(CA_NEXT_PLAYER_DELTA, 0);
    if (ctx.status.consume(actor.id, commonStatuses.doubleMove)) {
      delta *= 2;
    }
    incrementIdleCounters(actor.id, delta, ctx);
    movePlayer(state, actor.id, delta, 0, true, ctx);
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      total: value,
    });
    ctx.turn.complete({ waiting: ctx.choice.current() != null });
  },
});

export const CA_DERAPE_ACTIONS = { roll };

export function resolveDeltaChoice(value: number, ctx: RuleContext): void {
  const pending = ctx.choice.consumeContinuation<{
    kind: 'next-delta';
    actorId: number;
  }>();
  if (pending?.kind !== 'next-delta') {
    rejectRule('Choix Ça Dérape inattendu');
  }
  if (value !== -1 && value !== 1) rejectRule('Delta invalide');
  ctx.counters.set(CA_NEXT_PLAYER_DELTA, value);
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

function resolveCaDerapeTile(
  _state: CaDerapeState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: CA_DERAPE_TILES,
    depth,
    maxDepth: MAX_DEPTH,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position: current, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: current });
      if (current >= FINISH) {
        ctx.match.finish({ winners: [playerId], reason: 'finish-line' });
        return;
      }
      if (tile.isNeutral) return;
      const card = drawEvent<CaDerapeState, CaCard>(ctx, {
        deckId: DECK,
        playerId,
        recycle: true,
        discard: true,
      });
      if (!card) return;
      ctx.events.message('game.card.drawn', {
        playerId,
        deckId: 'events',
        cardId: card.id,
      });
      ctx.effects.schedule(...card.effects);
    },
  });
}

export function applySpecial(
  state: CaDerapeState,
  actorId: number,
  effect: CaSpecialEffect,
  delta: number,
  ctx: RuleContext,
): void {
  if (effect === 'take-lead') {
    const lead = Math.max(
      ...ctx.players
        .all()
        .filter((player) => player.id !== actorId)
        .map((player) => positionOf(ctx, TRACK, player.id)),
    );
    ctx.movement.moveTo(TRACK, actorId, Math.min(FINISH, lead + 1));
  } else if (effect === 'move-and-shield') {
    movePlayer(state, actorId, 4, 0, true, ctx);
    addUntilUsedStatus(actorId, commonStatuses.shield, ctx);
  } else if (effect === 'leapfrog') {
    const ahead = ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== actorId &&
          positionOf(ctx, TRACK, player.id) > positionOf(ctx, TRACK, actorId),
      )
      .sort(
        (left, right) =>
          positionOf(ctx, TRACK, left.id) - positionOf(ctx, TRACK, right.id),
      )[0];
    if (ahead) {
      ctx.movement.moveTo(
        TRACK,
        actorId,
        Math.min(FINISH, positionOf(ctx, TRACK, ahead.id) + 1),
      );
      ctx.movement.moveTo(
        TRACK,
        ahead.id,
        Math.max(0, positionOf(ctx, TRACK, ahead.id) - 1),
      );
    }
  } else if (effect === 'next-multiple-five') {
    const current = positionOf(ctx, TRACK, actorId);
    const next =
      Array.from(
        { length: FINISH - current },
        (_entry, index) => current + index + 1,
      ).find((candidate) => (candidate + 1) % 5 === 0) ?? FINISH;
    ctx.movement.moveTo(TRACK, actorId, next);
  } else if (effect === 'move-and-replay') {
    movePlayer(state, actorId, delta || 3, 0, true, ctx);
    ctx.turn.extra();
  } else if (effect === 'move-and-swap') {
    movePlayer(state, actorId, delta || 2, 0, true, ctx);
    if (ctx.match.lifecycle() !== 'finished') {
      scheduleTargetEffect('ca-derape.swap', ctx);
    }
  }
}

export function applyGlobal(effect: CaGlobalEffect, ctx: RuleContext): void {
  const ids = ctx.players.all().map((player) => player.id);
  if (effect === 'shuffle')
    assignPositions(
      ids,
      ctx.random.shuffle(ids.map((id) => positionOf(ctx, TRACK, id))),
      ctx,
    );
  else if (effect === 'reverse-ranking') {
    const ranked = [...ids].sort(
      (a, b) => positionOf(ctx, TRACK, a) - positionOf(ctx, TRACK, b),
    );
    assignPositions(
      ranked,
      ranked.map((id) => positionOf(ctx, TRACK, id)).reverse(),
      ctx,
    );
  } else if (effect === 'skip-all') {
    for (const id of ids) ctx.turn.skip(id, 1);
  } else if (effect === 'advance-all') moveAll(ids, 1, ctx);
  else if (effect === 'retreat-all') moveAll(ids, -2, ctx);
  else if (effect === 'cycle-ranking') {
    const ranked = [...ids].sort(
      (a, b) => positionOf(ctx, TRACK, b) - positionOf(ctx, TRACK, a),
    );
    const values = ranked.map((id) => positionOf(ctx, TRACK, id));
    assignPositions(
      ranked,
      values.map((_value, index) => values[(index + 1) % values.length]),
      ctx,
    );
  } else if (effect === 'random-roll-all') {
    for (const id of ids)
      ctx.movement.moveTo(
        TRACK,
        id,
        Math.min(FINISH, positionOf(ctx, TRACK, id) + ctx.random.int(6) + 1),
      );
  }
}

export function applyConditional(
  state: CaDerapeState,
  actorId: number,
  effect: CaConditionalEffect,
  ctx: RuleContext,
): void {
  const ids = ctx.players.all().map((player) => player.id);
  const ranked = [...ids].sort(
    (a, b) => positionOf(ctx, TRACK, a) - positionOf(ctx, TRACK, b),
  );
  if (effect === 'leader-retreat-others-advance')
    applyPenaltyAwareMove(
      state,
      actorId,
      actorId === ranked.at(-1) ? -2 : 2,
      0,
      ctx,
    );
  else if (effect === 'last-advance' && actorId === ranked[0])
    movePlayer(state, actorId, 3, 0, true, ctx);
  else if (
    effect === 'after-retreat' &&
    ctx.resources.get(actorId, CA_LAST_MOVE) < 0
  )
    movePlayer(state, actorId, 3, 0, true, ctx);
  else if (effect === 'cancel-skip' && ctx.turn.skipCount(actorId) > 0)
    ctx.turn.cancelSkip(actorId, 1);
  else if (effect === 'multiple-five')
    applyPenaltyAwareMove(
      state,
      actorId,
      (positionOf(ctx, TRACK, actorId) + 1) % 5 === 0 ? 4 : -1,
      0,
      ctx,
    );
  else if (
    effect === 'after-idle' &&
    ctx.resources.get(actorId, CA_IDLE_TURNS) >= 2
  )
    movePlayer(state, actorId, 5, 0, true, ctx);
  else if (effect === 'shared-position') {
    const other = ids.find(
      (id) =>
        id !== actorId &&
        positionOf(ctx, TRACK, id) === positionOf(ctx, TRACK, actorId),
    );
    if (other != null) {
      ctx.movement.moveTo(
        TRACK,
        actorId,
        Math.min(FINISH, positionOf(ctx, TRACK, actorId) + 2),
      );
      ctx.movement.moveTo(
        TRACK,
        other,
        Math.min(FINISH, positionOf(ctx, TRACK, other) + 2),
      );
    }
  } else if (effect === 'replay') ctx.turn.extra();
  else if (effect === 'join-ahead') {
    const ahead = ranked[ranked.indexOf(actorId) + 1];
    if (
      ahead != null &&
      positionOf(ctx, TRACK, ahead) === positionOf(ctx, TRACK, actorId) + 1
    )
      ctx.movement.moveTo(TRACK, actorId, positionOf(ctx, TRACK, ahead));
  } else if (
    effect === 'after-one-step' &&
    ctx.resources.get(actorId, CA_LAST_MOVE) === 1
  )
    movePlayer(state, actorId, 1, 0, true, ctx);
}

export function applyRule(
  state: CaDerapeState,
  actorId: number,
  effect: CaRuleEffect,
  ctx: RuleContext,
): void {
  if (effect === 'roll-two')
    movePlayer(
      state,
      actorId,
      ctx.random.int(6) + ctx.random.int(6) + 2,
      0,
      true,
      ctx,
    );
  else if (effect === 'draw-extra') {
    const extra = drawEvent<CaDerapeState, CaCard>(ctx, {
      deckId: DECK,
      playerId: actorId,
      recycle: true,
      discard: true,
    });
    if (extra) ctx.effects.schedule(...extra.effects);
  } else if (effect === 'double-move')
    addUntilUsedStatus(actorId, commonStatuses.doubleMove, ctx);
  else if (effect === 'retreat-one')
    applyPenaltyAwareMove(state, actorId, -1, 0, ctx);
  else if (effect === 'shield')
    addUntilUsedStatus(actorId, commonStatuses.shield, ctx);
  else if (effect === 'advance-two')
    movePlayer(state, actorId, 2, 0, true, ctx);
  else if (effect === 'choose-next-player')
    scheduleTargetEffect('ca-derape.next-player', ctx, false);
  else if (effect === 'choose-next-delta') requestDeltaChoice(actorId, ctx);
  else if (effect === 'double-roll')
    addUntilUsedStatus(actorId, commonStatuses.doubleRoll, ctx);
  else if (effect === 'mirror-roll')
    scheduleTargetEffect('ca-derape.mirror', ctx);
}

function scheduleTargetEffect(
  effectId: 'ca-derape.swap' | 'ca-derape.next-player' | 'ca-derape.mirror',
  ctx: RuleContext,
  completeTurn = true,
): void {
  ctx.effects.schedule(
    gameEffects.custom(
      effectId,
      {},
      gameEffects.target.chosenOpponent(effectId),
    ),
    ...(completeTurn ? [gameEffects.completeTurn()] : []),
  );
}

function requestDeltaChoice(actorId: number, ctx: RuleContext): void {
  ctx.choice.one({
    id: 'ca-derape.next-delta',
    player: actorId,
    options: [1, -1],
    data: { kind: 'next-delta', actorId },
    label: (value) => (value > 0 ? 'Avancer de 1' : 'Reculer de 1'),
  });
}

export function applyPenaltyAwareMove(
  state: CaDerapeState,
  actorId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (delta < 0 && consumePenaltyShield(actorId, ctx)) return;
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
  const target = Math.min(
    FINISH,
    Math.max(0, positionOf(ctx, TRACK, playerId) + delta),
  );
  ctx.movement.moveTo(TRACK, playerId, target);
  ctx.resources.set(playerId, CA_LAST_MOVE, delta);
  if (delta !== 0) ctx.resources.set(playerId, CA_IDLE_TURNS, 0);
  if (resolve) resolveCaDerapeTile(state, playerId, depth + 1, ctx);
}

export function consumePenaltyShield(
  actorId: number,
  ctx: RuleContext,
): boolean {
  return ctx.status.consume(actorId, commonStatuses.shield);
}

function addUntilUsedStatus(
  playerId: number,
  statusId: string,
  ctx: RuleContext,
): void {
  ctx.status.add(playerId, statusId, { scope: 'until-used' });
}

function incrementIdleCounters(
  actorId: number,
  delta: number,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all())
    ctx.resources.add(player.id, CA_IDLE_TURNS, 1);
  if (delta !== 0) ctx.resources.set(actorId, CA_IDLE_TURNS, 0);
}

export function caResourceMap(
  ctx: RuleContext,
  resourceId: string,
): PlayerMap<number> {
  return ctx.players.byId((player) => ctx.resources.get(player.id, resourceId));
}

export function mirrorSourceMap(ctx: RuleContext): PlayerMap<number | null> {
  return ctx.players.byId((player) => mirrorSource(player.id, ctx));
}

function mirrorSource(playerId: number, ctx: RuleContext): number | null {
  const value = ctx.status.get(playerId, CA_MIRROR_ROLL)?.data.sourcePlayerId;
  return typeof value === 'number' ? value : null;
}

export function markWinnerIfReached(ctx: RuleContext): void {
  const winner = ctx.players
    .all()
    .find((player) => positionOf(ctx, TRACK, player.id) >= FINISH);
  if (winner) {
    ctx.match.finish({ winners: [winner.id], reason: 'finish-line' });
  }
}

function moveAll(ids: number[], delta: number, ctx: RuleContext): void {
  for (const id of ids)
    ctx.movement.moveTo(
      TRACK,
      id,
      Math.min(FINISH, Math.max(0, positionOf(ctx, TRACK, id) + delta)),
    );
}

function assignPositions(
  ids: number[],
  values: number[],
  ctx: RuleContext,
): void {
  ids.forEach((id, index) =>
    ctx.movement.moveTo(TRACK, id, values[index] ?? 0),
  );
}
