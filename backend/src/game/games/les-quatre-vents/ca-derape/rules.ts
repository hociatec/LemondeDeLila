import {
  commonStatuses,
  defineAction,
  gameEffects,
  gameInput,
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
      mirroredFrom == null
        ? 0
        : ctx.resources.get(mirroredFrom, CA_LAST_ROLL);
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

export function resolveDeltaChoice(
  value: number,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeData<{
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

function resolveLanding(
  state: CaDerapeState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.match.lifecycle() === 'finished') return;
  const current = position(playerId, ctx);
  const tile = CA_DERAPE_TILES[current];
  ctx.events.message('game.pawn.landed', { playerId, tileId: current });
  if (current >= FINISH) {
    ctx.match.finish({ winners: [playerId], reason: 'finish-line' });
    return;
  }
  if (tile.isNeutral) return;
  const card = drawCard(ctx);
  if (!card) return;
  ctx.events.message('game.card.drawn', {
    playerId,
    deckId: 'events',
    cardId: card.id,
  });
  ctx.effects.schedule(...card.effects);
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
        .map((player) => position(player.id, ctx)),
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
          position(player.id, ctx) > position(actorId, ctx),
      )
      .sort(
        (left, right) => position(left.id, ctx) - position(right.id, ctx),
      )[0];
    if (ahead) {
      ctx.movement.moveTo(
        TRACK,
        actorId,
        Math.min(FINISH, position(ahead.id, ctx) + 1),
      );
      ctx.movement.moveTo(
        TRACK,
        ahead.id,
        Math.max(0, position(ahead.id, ctx) - 1),
      );
    }
  } else if (effect === 'next-multiple-five') {
    const current = position(actorId, ctx);
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

export function applyGlobal(
  effect: CaGlobalEffect,
  ctx: RuleContext,
): void {
  const ids = ctx.players.all().map((player) => player.id);
  if (effect === 'shuffle')
    assignPositions(
      ids,
      ctx.random.shuffle(ids.map((id) => position(id, ctx))),
      ctx,
    );
  else if (effect === 'reverse-ranking') {
    const ranked = [...ids].sort((a, b) => position(a, ctx) - position(b, ctx));
    assignPositions(
      ranked,
      ranked.map((id) => position(id, ctx)).reverse(),
      ctx,
    );
  } else if (effect === 'skip-all') {
    for (const id of ids) ctx.turn.skip(id, 1);
  } else if (effect === 'advance-all') moveAll(ids, 1, ctx);
  else if (effect === 'retreat-all') moveAll(ids, -2, ctx);
  else if (effect === 'cycle-ranking') {
    const ranked = [...ids].sort((a, b) => position(b, ctx) - position(a, ctx));
    const values = ranked.map((id) => position(id, ctx));
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
        Math.min(FINISH, position(id, ctx) + ctx.random.int(6) + 1),
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
  const ranked = [...ids].sort((a, b) => position(a, ctx) - position(b, ctx));
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
      (position(actorId, ctx) + 1) % 5 === 0 ? 4 : -1,
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
      (id) => id !== actorId && position(id, ctx) === position(actorId, ctx),
    );
    if (other != null) {
      ctx.movement.moveTo(
        TRACK,
        actorId,
        Math.min(FINISH, position(actorId, ctx) + 2),
      );
      ctx.movement.moveTo(
        TRACK,
        other,
        Math.min(FINISH, position(other, ctx) + 2),
      );
    }
  } else if (effect === 'replay') ctx.turn.extra();
  else if (effect === 'join-ahead') {
    const ahead = ranked[ranked.indexOf(actorId) + 1];
    if (ahead != null && position(ahead, ctx) === position(actorId, ctx) + 1)
      ctx.movement.moveTo(TRACK, actorId, position(ahead, ctx));
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
    const extra = drawCard(ctx);
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

function requestDeltaChoice(
  actorId: number,
  ctx: RuleContext,
): void {
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
  const target = Math.min(FINISH, Math.max(0, position(playerId, ctx) + delta));
  ctx.movement.moveTo(TRACK, playerId, target);
  ctx.resources.set(playerId, CA_LAST_MOVE, delta);
  if (delta !== 0) ctx.resources.set(playerId, CA_IDLE_TURNS, 0);
  if (resolve) resolveLanding(state, playerId, depth + 1, ctx);
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
  return Object.fromEntries(
    ctx.players
      .all()
      .map((player) => [player.id, ctx.resources.get(player.id, resourceId)]),
  );
}

export function mirrorSourceMap(
  ctx: RuleContext,
): PlayerMap<number | null> {
  return Object.fromEntries(
    ctx.players
      .all()
      .map((player) => [player.id, mirrorSource(player.id, ctx)]),
  );
}

function mirrorSource(playerId: number, ctx: RuleContext): number | null {
  const value = ctx.status.get(playerId, CA_MIRROR_ROLL)?.data.sourcePlayerId;
  return typeof value === 'number' ? value : null;
}

export function markWinnerIfReached(ctx: RuleContext): void {
  const winner = ctx.players
    .all()
    .find((player) => position(player.id, ctx) >= FINISH);
  if (winner) {
    ctx.match.finish({ winners: [winner.id], reason: 'finish-line' });
  }
}

function drawCard(ctx: RuleContext): CaCard | null {
  const card = ctx.cards.drawOrRecycle<CaCard>(DECK);
  if (card) ctx.cards.discard(DECK, card);
  return card;
}

function moveAll(ids: number[], delta: number, ctx: RuleContext): void {
  for (const id of ids)
    ctx.movement.moveTo(
      TRACK,
      id,
      Math.min(FINISH, Math.max(0, position(id, ctx) + delta)),
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

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}
