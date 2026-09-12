import type { DerapeRaceProgram } from '../../extensions/derape-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import { gameEffects } from '../../effects/effects-dsl';
import { drawEvent } from './card-dice.recipes';
import { commonStatuses } from '../../kits/player-values-contracts';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = DerapeRaceProgram['cards'][number];
import {
  derapeConditionalEffects as conditionals,
  derapeGlobalEffects as globals,
  derapeRuleEffects as rules,
  derapeSpecialEffects as specials,
  type DerapeConditionalEffect as Conditional,
  type DerapeGlobalEffect as Global,
  type DerapeRuleEffect as Rule,
  type DerapeSpecialEffect as Special,
} from '../../contracts/derape-effect-types';

function resolveTile(
  program: DerapeRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  ctx.movement.resolveLanding({
    trackId: program.trackId,
    playerId,
    tiles: program.tiles,
    depth,
    maxDepth: program.maxDepth,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (position >= program.tiles.length - 1) {
        ctx.match.finish({ winners: [playerId], reason: program.finishReason });
        return;
      }
      if (tile.isNeutral) return;
      const card = drawEvent<State, Card>(ctx, {
        deckId: program.deckId,
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
export function derapeEffects(program: DerapeRaceProgram) {
  return {
    'ca-derape.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          penaltyMove(program, actorPlayerId, data.delta, ctx);
      },
    }),
    'ca-derape.skip-penalty': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (
          actorPlayerId != null &&
          !ctx.status.consume(actorPlayerId, commonStatuses.shield)
        )
          ctx.turn.skip(actorPlayerId, 1);
      },
    }),
    'ca-derape.special': defineEffect<
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
    'ca-derape.global': defineEffect<State, { effect: Global }>({
      input: gameInput.object({ effect: gameInput.enum(globals) }),
      apply: ({ data, ctx }) => applyGlobal(program, data.effect, ctx),
    }),
    'ca-derape.conditional': defineEffect<State, { effect: Conditional }>({
      input: gameInput.object({ effect: gameInput.enum(conditionals) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          applyConditional(program, actorPlayerId, data.effect, ctx);
      },
    }),
    'ca-derape.rule': defineEffect<State, { effect: Rule }>({
      input: gameInput.object({ effect: gameInput.enum(rules) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          applyRule(program, actorPlayerId, data.effect, ctx);
      },
    }),
    'ca-derape.mark-winner': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ ctx }) => markWinner(program, ctx),
    }),
    'ca-derape.next-player': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ targetPlayerIds, ctx }) => {
        if (targetPlayerIds[0] != null) ctx.turn.to(targetPlayerIds[0]);
      },
    }),
    'ca-derape.mirror': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        if (actorPlayerId != null && targetPlayerIds[0] != null)
          ctx.status.add(actorPlayerId, program.mirrorStatusId, {
            scope: 'until-used',
            data: { sourcePlayerId: targetPlayerIds[0] },
          });
      },
    }),
  };
}

function applySpecial(
  program: DerapeRaceProgram,
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
    moveDerapePlayer(program, actorId, 4, true, ctx);
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
      ).find((candidate) => (candidate + 1) % 5 === 0) ?? finish;
    ctx.movement.moveTo(program.trackId, actorId, next);
  } else if (effect === 'move-and-replay') {
    moveDerapePlayer(program, actorId, delta || 3, true, ctx);
    ctx.turn.extra();
  } else if (effect === 'move-and-swap') {
    moveDerapePlayer(program, actorId, delta || 2, true, ctx);
    if (ctx.match.lifecycle() !== 'finished')
      ctx.effects.schedule(
        gameEffects.swapPositions(
          program.trackId,
          gameEffects.target.self(),
          gameEffects.target.chosenOpponent('ca-derape.swap'),
        ),
        gameEffects.completeTurn(),
      );
  }
}

function applyGlobal(program: DerapeRaceProgram, effect: Global, ctx: Context) {
  const ids = ctx.players.all().map((player) => player.id);
  if (effect === 'shuffle')
    assign(
      program,
      ids,
      ctx.random.shuffle(ids.map((id) => position(program, id, ctx))),
      ctx,
    );
  else if (effect === 'reverse-ranking') {
    const ranked = rankedIds(program, ids, 'asc', ctx);
    assign(
      program,
      ranked,
      ranked.map((id) => position(program, id, ctx)).reverse(),
      ctx,
    );
  } else if (effect === 'skip-all') for (const id of ids) ctx.turn.skip(id, 1);
  else if (effect === 'advance-all') moveAll(program, ids, 1, ctx);
  else if (effect === 'retreat-all') moveAll(program, ids, -2, ctx);
  else if (effect === 'cycle-ranking') {
    const ranked = rankedIds(program, ids, 'desc', ctx);
    const values = ranked.map((id) => position(program, id, ctx));
    assign(
      program,
      ranked,
      values.map((_value, index) => values[(index + 1) % values.length]),
      ctx,
    );
  } else if (effect === 'random-roll-all')
    for (const id of ids)
      ctx.movement.moveTo(
        program.trackId,
        id,
        Math.min(
          program.tiles.length - 1,
          position(program, id, ctx) + ctx.random.int(6) + 1,
        ),
      );
}

function applyConditional(
  program: DerapeRaceProgram,
  actorId: number,
  effect: Conditional,
  ctx: Context,
) {
  const ids = ctx.players.all().map((player) => player.id);
  const ranked = rankedIds(program, ids, 'asc', ctx);
  if (effect === 'leader-retreat-others-advance')
    penaltyMove(program, actorId, actorId === ranked.at(-1) ? -2 : 2, ctx);
  else if (effect === 'last-advance' && actorId === ranked[0])
    moveDerapePlayer(program, actorId, 3, true, ctx);
  else if (
    effect === 'after-retreat' &&
    ctx.resources.get(actorId, program.resources.lastMove) < 0
  )
    moveDerapePlayer(program, actorId, 3, true, ctx);
  else if (effect === 'cancel-skip' && ctx.turn.skipCount(actorId) > 0)
    ctx.turn.cancelSkip(actorId, 1);
  else if (effect === 'multiple-five')
    penaltyMove(
      program,
      actorId,
      (position(program, actorId, ctx) + 1) % 5 === 0 ? 4 : -1,
      ctx,
    );
  else if (
    effect === 'after-idle' &&
    ctx.resources.get(actorId, program.resources.idleTurns) >= 2
  )
    moveDerapePlayer(program, actorId, 5, true, ctx);
  else if (effect === 'shared-position') {
    const other = ids.find(
      (id) =>
        id !== actorId &&
        position(program, id, ctx) === position(program, actorId, ctx),
    );
    if (other != null) {
      ctx.movement.moveTo(
        program.trackId,
        actorId,
        Math.min(program.tiles.length - 1, position(program, actorId, ctx) + 2),
      );
      ctx.movement.moveTo(
        program.trackId,
        other,
        Math.min(program.tiles.length - 1, position(program, other, ctx) + 2),
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
    moveDerapePlayer(program, actorId, 1, true, ctx);
}

function applyRule(
  program: DerapeRaceProgram,
  actorId: number,
  effect: Rule,
  ctx: Context,
) {
  if (effect === 'roll-two')
    moveDerapePlayer(
      program,
      actorId,
      ctx.random.int(6) + ctx.random.int(6) + 2,
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
    moveDerapePlayer(program, actorId, 2, true, ctx);
  else if (effect === 'choose-next-player')
    targetEffect('ca-derape.next-player', ctx, false);
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
  else if (effect === 'mirror-roll') targetEffect('ca-derape.mirror', ctx);
}

function targetEffect(
  effectId: 'ca-derape.next-player' | 'ca-derape.mirror',
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
  program: DerapeRaceProgram,
  actorId: number,
  delta: number,
  ctx: Context,
) {
  if (delta < 0 && ctx.status.consume(actorId, commonStatuses.shield)) return;
  moveDerapePlayer(program, actorId, delta, true, ctx);
}

export function moveDerapePlayer(
  program: DerapeRaceProgram,
  playerId: number,
  delta: number,
  resolve: boolean,
  ctx: Context,
) {
  const target = Math.min(
    program.tiles.length - 1,
    Math.max(0, position(program, playerId, ctx) + delta),
  );
  ctx.movement.moveTo(program.trackId, playerId, target);
  ctx.resources.set(playerId, program.resources.lastMove, delta);
  if (delta !== 0) ctx.resources.set(playerId, program.resources.idleTurns, 0);
  if (resolve) resolveTile(program, playerId, 1, ctx);
}

function markWinner(program: DerapeRaceProgram, ctx: Context) {
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

function position(program: DerapeRaceProgram, id: number, ctx: Context) {
  return ctx.movement.position(program.trackId, id);
}
function rankedIds(
  program: DerapeRaceProgram,
  ids: number[],
  direction: 'asc' | 'desc',
  ctx: Context,
) {
  return ctx.ranking
    .rank(ids, { value: (id) => position(program, id, ctx), direction })
    .map((entry) => entry.playerId);
}
function moveAll(
  program: DerapeRaceProgram,
  ids: number[],
  delta: number,
  ctx: Context,
) {
  for (const id of ids)
    ctx.movement.moveTo(
      program.trackId,
      id,
      Math.min(
        program.tiles.length - 1,
        Math.max(0, position(program, id, ctx) + delta),
      ),
    );
}
function assign(
  program: DerapeRaceProgram,
  ids: number[],
  values: number[],
  ctx: Context,
) {
  ids.forEach((id, index) =>
    ctx.movement.moveTo(program.trackId, id, values[index] ?? 0),
  );
}
