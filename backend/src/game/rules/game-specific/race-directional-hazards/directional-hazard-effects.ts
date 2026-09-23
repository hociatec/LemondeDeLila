import { resolveTile } from './directional-hazard-landing';
import { firstOtherPlayerAt } from '../../recipes/track-collision';
import {
  gameInput,
  gameEffects,
  drawEvent,
  commonStatuses,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { applyGlobal } from './directional-hazard-global-effects';
import { consumeFirstProtection } from '../../recipes/protection-cost';
import type { DirectionalHazardRaceProgram } from './program';
import {
  defineEffect,
  defineEmptyEffect,
} from '../../../engine/runtime/effects/effects-core';
import {
  directionalHazardPosition as position,
  rankedDirectionalHazardPlayerIds as rankedIds,
} from './directional-hazard-movement';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = DirectionalHazardRaceProgram['cards'][number];
import {
  directionalHazardConditionalEffects as conditionals,
  directionalHazardGlobalEffects as globals,
  directionalHazardRuleEffects as rules,
  directionalHazardSpecialEffects as specials,
  type DirectionalHazardConditionalEffect as Conditional,
  type DirectionalHazardGlobalEffect as Global,
  type DirectionalHazardRuleEffect as Rule,
  type DirectionalHazardSpecialEffect as Special,
} from './directional-hazard-effect-types';

export function directionalHazardEffects(
  program: DirectionalHazardRaceProgram,
) {
  return {
    'race-hazard.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          penaltyMove(program, actorPlayerId, data.delta, ctx);
      },
    }),
    'race-hazard.skip-penalty': defineEmptyEffect<State>(
      ({ actorPlayerId, ctx }) => {
        if (
          actorPlayerId != null &&
          consumeFirstProtection(ctx, actorPlayerId, [
            { status: commonStatuses.shield },
          ]) === undefined
        )
          ctx.turn.skip(actorPlayerId, 1);
      },
    ),
    'race-hazard.special': defineEffect<
      State,
      { effect: Special; delta: number }
    >({
      input: gameInput.object({
        effect: gameInput.enum(specials),
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          applySpecial(program, actorPlayerId, data.effect, data.delta, ctx);
      },
    }),
    'race-hazard.global': defineEffect<State, { effect: Global }>({
      input: gameInput.object({ effect: gameInput.enum(globals) }),
      apply: ({ data, ctx }) => applyGlobal(program, data.effect, ctx),
    }),
    'race-hazard.conditional': defineEffect<State, { effect: Conditional }>({
      input: gameInput.object({ effect: gameInput.enum(conditionals) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          applyConditional(program, actorPlayerId, data.effect, ctx);
      },
    }),
    'race-hazard.rule': defineEffect<State, { effect: Rule }>({
      input: gameInput.object({ effect: gameInput.enum(rules) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          applyRule(program, actorPlayerId, data.effect, ctx);
      },
    }),
    'race-hazard.mark-winner': defineEmptyEffect<State>(({ ctx }) =>
      markWinner(program, ctx),
    ),
    'race-hazard.next-player': defineEmptyEffect<State>(
      ({ targetPlayerIds, ctx }) => {
        if (targetPlayerIds[0] != null) ctx.turn.to(targetPlayerIds[0]);
      },
    ),
    'race-hazard.mirror': defineEmptyEffect<State>(
      ({ actorPlayerId, targetPlayerIds, ctx }) => {
        if (actorPlayerId != null && targetPlayerIds[0] != null)
          ctx.status.add(actorPlayerId, program.mirrorStatusId, {
            scope: 'until-used',
            data: { sourcePlayerId: targetPlayerIds[0] },
          });
      },
    ),
  };
}

function applySpecial(
  program: DirectionalHazardRaceProgram,
  actorId: number,
  effect: Special,
  delta: number,
  ctx: Context,
) {
  const finish = program.tiles.length - 1;
  if (effect === 'take-lead') {
    const lead = Math.max(
      ...ctx.players
        .others(actorId)
        .map((player) => position(program, player.id, ctx)),
    );
    ctx.movement.moveTo(program.trackId, actorId, Math.min(finish, lead + 1));
  } else if (effect === 'move-and-shield') {
    moveDirectionalHazardPlayer(
      program,
      actorId,
      program.parameters.shieldAdvance,
      true,
      ctx,
    );
    ctx.status.add(actorId, commonStatuses.shield, { scope: 'until-used' });
  } else if (effect === 'leapfrog') {
    const ahead = ctx.ranking.rank(
      ctx.players
        .otherIds(actorId)
        .filter(
          (id) => position(program, id, ctx) > position(program, actorId, ctx),
        ),
      { value: (id) => position(program, id, ctx), direction: 'asc' },
    )[0];
    if (ahead) {
      ctx.movement.moveTo(
        program.trackId,
        actorId,
        Math.min(finish, position(program, ahead.playerId, ctx) + 1),
      );
      ctx.movement.moveTo(
        program.trackId,
        ahead.playerId,
        Math.max(0, position(program, ahead.playerId, ctx) - 1),
      );
    }
  } else if (effect === 'next-multiple-five') {
    const current = position(program, actorId, ctx);
    const next =
      Array.from(
        { length: finish - current },
        (_entry, index) => current + index + 1,
      ).find(
        (candidate) =>
          (candidate + 1) % program.parameters.checkpointSpan === 0,
      ) ?? finish;
    ctx.movement.moveTo(program.trackId, actorId, next);
  } else if (effect === 'move-and-replay') {
    moveDirectionalHazardPlayer(
      program,
      actorId,
      delta || program.parameters.replayAdvance,
      true,
      ctx,
    );
    ctx.turn.extra();
  } else if (effect === 'move-and-swap') {
    moveDirectionalHazardPlayer(
      program,
      actorId,
      delta || program.parameters.swapAdvance,
      true,
      ctx,
    );
    if (ctx.match.lifecycle() !== 'finished')
      ctx.effects.schedule(
        gameEffects.swapPositions(
          program.trackId,
          gameEffects.target.self(),
          gameEffects.target.chosenOpponent('race-hazard.swap'),
        ),
        gameEffects.completeTurn(),
      );
  }
}

function applyConditional(
  program: DirectionalHazardRaceProgram,
  actorId: number,
  effect: Conditional,
  ctx: Context,
) {
  const ids = ctx.players.all().map((player) => player.id);
  const ranked = rankedIds(program, ids, 'asc', ctx);
  if (effect === 'leader-retreat-others-advance')
    penaltyMove(
      program,
      actorId,
      actorId === ranked.at(-1)
        ? program.parameters.leaderRetreat
        : program.parameters.othersAdvance,
      ctx,
    );
  else if (effect === 'last-advance' && actorId === ranked[0])
    moveDirectionalHazardPlayer(
      program,
      actorId,
      program.parameters.lastAdvance,
      true,
      ctx,
    );
  else if (
    effect === 'after-retreat' &&
    ctx.resources.get(actorId, program.resources.lastMove) < 0
  )
    moveDirectionalHazardPlayer(
      program,
      actorId,
      program.parameters.retreatRecovery,
      true,
      ctx,
    );
  else if (effect === 'cancel-skip' && ctx.turn.skipCount(actorId) > 0)
    ctx.turn.cancelSkip(actorId, 1);
  else if (effect === 'multiple-five')
    penaltyMove(
      program,
      actorId,
      (position(program, actorId, ctx) + 1) %
        program.parameters.checkpointSpan ===
        0
        ? program.parameters.checkpointSuccess
        : program.parameters.checkpointFailure,
      ctx,
    );
  else if (
    effect === 'after-idle' &&
    ctx.resources.get(actorId, program.resources.idleTurns) >=
      program.parameters.idleThreshold
  )
    moveDirectionalHazardPlayer(
      program,
      actorId,
      program.parameters.idleAdvance,
      true,
      ctx,
    );
  else applyRelativePosition(program, actorId, effect, ctx);
}

function applyRelativePosition(
  program: DirectionalHazardRaceProgram,
  actorId: number,
  effect: Conditional,
  ctx: Context,
) {
  const ids = ctx.players.all().map((player) => player.id);
  const ranked = rankedIds(program, ids, 'asc', ctx);
  if (effect === 'shared-position') {
    const other = firstOtherPlayerAt(
      ctx,
      program.trackId,
      position(program, actorId, ctx),
      actorId,
    );
    if (other != null) {
      ctx.movement.moveTo(
        program.trackId,
        actorId,
        Math.min(
          program.tiles.length - 1,
          position(program, actorId, ctx) + program.parameters.sharedAdvance,
        ),
      );
      ctx.movement.moveTo(
        program.trackId,
        other,
        Math.min(
          program.tiles.length - 1,
          position(program, other, ctx) + program.parameters.sharedAdvance,
        ),
      );
    }
  } else if (effect === 'replay') ctx.turn.extra();
  else if (effect === 'join-ahead') {
    const ahead = ranked[ranked.indexOf(actorId) + 1];
    if (
      ahead != null &&
      position(program, ahead, ctx) === position(program, actorId, ctx) + 1
    )
      ctx.movement.moveTo(
        program.trackId,
        actorId,
        position(program, ahead, ctx),
      );
  } else if (
    effect === 'after-one-step' &&
    ctx.resources.get(actorId, program.resources.lastMove) === 1
  )
    moveDirectionalHazardPlayer(program, actorId, 1, true, ctx);
}

function applyRule(
  program: DirectionalHazardRaceProgram,
  actorId: number,
  effect: Rule,
  ctx: Context,
) {
  if (effect === 'roll-two')
    moveDirectionalHazardPlayer(
      program,
      actorId,
      ctx.random.int(program.parameters.randomSides) +
        ctx.random.int(program.parameters.randomSides) +
        2,
      true,
      ctx,
    );
  else if (effect === 'draw-extra') {
    const card = drawEvent<State, Card>(ctx, {
      deckId: program.deckId,
      playerId: actorId,
      recycle: true,
      discard: true,
    });
    if (card) ctx.effects.schedule(...card.effects);
  } else if (effect === 'double-move')
    ctx.status.add(actorId, commonStatuses.doubleMove, { scope: 'until-used' });
  else if (effect === 'retreat-one') penaltyMove(program, actorId, -1, ctx);
  else if (effect === 'shield')
    ctx.status.add(actorId, commonStatuses.shield, { scope: 'until-used' });
  else if (effect === 'advance-two')
    moveDirectionalHazardPlayer(program, actorId, 2, true, ctx);
  else if (effect === 'choose-next-player')
    targetEffect('race-hazard.next-player', ctx, false);
  else if (effect === 'choose-next-delta')
    ctx.choice.one({
      id: program.nextDeltaChoiceId,
      player: actorId,
      options: [1, -1],
      data: { kind: 'next-delta', actorId },
      label: (value) => (value > 0 ? 'Avancer de 1' : 'Reculer de 1'),
    });
  else if (effect === 'double-roll')
    ctx.status.add(actorId, commonStatuses.doubleRoll, { scope: 'until-used' });
  else if (effect === 'mirror-roll') targetEffect('race-hazard.mirror', ctx);
}

function targetEffect(
  effectId: 'race-hazard.next-player' | 'race-hazard.mirror',
  ctx: Context,
  complete = true,
) {
  ctx.effects.schedule(
    gameEffects.custom(
      effectId,
      {},
      gameEffects.target.chosenOpponent(effectId),
    ),
    ...(complete ? [gameEffects.completeTurn()] : []),
  );
}

function penaltyMove(
  program: DirectionalHazardRaceProgram,
  actorId: number,
  delta: number,
  ctx: Context,
) {
  if (delta < 0 && ctx.status.consume(actorId, commonStatuses.shield)) return;
  moveDirectionalHazardPlayer(program, actorId, delta, true, ctx);
}

export function moveDirectionalHazardPlayer(
  program: DirectionalHazardRaceProgram,
  playerId: number,
  delta: number,
  resolve: boolean,
  ctx: Context,
) {
  const target = ctx.movement.preview(program.trackId, playerId, delta);
  ctx.movement.moveTo(program.trackId, playerId, target);
  ctx.resources.set(playerId, program.resources.lastMove, delta);
  if (delta !== 0) ctx.resources.set(playerId, program.resources.idleTurns, 0);
  if (resolve) resolveTile(program, playerId, 1, ctx);
}

function markWinner(program: DirectionalHazardRaceProgram, ctx: Context) {
  if (program.victoryMode === 'external') return;
  const qualified = ctx.players
    .all()
    .filter(
      (player) => position(program, player.id, ctx) >= program.tiles.length - 1,
    )
    .map((player) => player.id);
  const winner = ctx.ranking.rank(qualified)[0];
  if (winner)
    ctx.match.finish({
      winners: [winner.playerId],
      reason: program.finishReason,
    });
}
