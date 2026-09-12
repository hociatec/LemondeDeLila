import type {
  FrousseBlock,
  FrousseRaceProgram,
} from '../../extensions/frousse-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { defineEffect } from '../../effects/effects-core';
import { drawAndResolve } from './card-dice.recipes';
import { sequentialPawnSelection } from './pawn-selection.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = FrousseRaceProgram['cards'][number];

export function frousseRaceRules(source: FrousseRaceProgram) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo('playing');
      const starter = ctx.round.starter();
      if (starter != null) ctx.turn.to(starter);
    },
  });
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ ctx }) =>
        ctx.phase.current() === 'playing' && !pendingSwap(program, ctx),
      execute: ({ actor, ctx }) => executeRoll(program, actor.id, ctx),
      documentation:
        'Lance le dé, applique les altérations puis résout la case.',
    }),
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
    effects: frousseEffects(program),
  };
}
function executeRoll(
  program: FrousseRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const blocked = blockedRule(program, playerId, ctx);
  if (blocked) {
    const value = ctx.dice.roll(program.diceId).total;
    ctx.events.message(`${program.eventNamespace}.block.escape-attempted`, {
      playerId,
      value,
    });
    if (passesBlock(value, blocked)) {
      ctx.status.remove(playerId, program.statuses.blocked);
      ctx.events.message(`${program.eventNamespace}.block.escaped`, {
        playerId,
      });
    }
    ctx.turn.end();
    return;
  }
  const value = modifiedRoll(program, playerId, ctx);
  ctx.events.message('game.dice.rolled', {
    playerId,
    diceId: program.diceId,
    total: value,
  });
  if (ctx.status.consume(playerId, program.statuses.nextRollIfThreeBackTwo)) {
    if (value === 3) moveAndResolve(program, playerId, -2, 0, ctx);
  }
  if (ctx.match.lifecycle() !== 'finished' && !pendingSwap(program, ctx)) {
    const cap = statusNumber(
      program,
      playerId,
      program.statuses.nextMoveCap,
      ctx,
    );
    ctx.status.remove(playerId, program.statuses.nextMoveCap);
    moveAndResolve(
      program,
      playerId,
      cap > 0 ? Math.min(value, cap) : value,
      0,
      ctx,
    );
  }
  ctx.turn.complete({ waiting: pendingSwap(program, ctx) });
}

function modifiedRoll(
  program: FrousseRaceProgram,
  playerId: number,
  ctx: Context,
) {
  let value: number;
  if (ctx.status.consume(playerId, program.statuses.nextRollKeepLowest)) {
    value = Math.min(
      ctx.dice.roll(program.diceId).total,
      ctx.dice.roll(program.diceId).total,
    );
  } else value = ctx.dice.roll(program.diceId).total;
  const malus = statusNumber(
    program,
    playerId,
    program.statuses.nextRollMalus,
    ctx,
  );
  ctx.status.remove(playerId, program.statuses.nextRollMalus);
  if (ctx.status.consume(playerId, program.statuses.nextRollDouble)) value *= 2;
  return Math.max(1, value + malus);
}

function moveAndResolve(
  program: FrousseRaceProgram,
  playerId: number,
  delta: number,
  depth: number,
  ctx: Context,
) {
  ctx.movement.moveAndResolve({
    trackId: program.trackId,
    playerId,
    distance: delta,
    tiles: program.tiles,
    depth: depth + 1,
    maxDepth: program.maxChainDepth,
    blocked: () =>
      ctx.match.lifecycle() === 'finished' || pendingSwap(program, ctx),
    onLand: ({ position, tile }) =>
      applyTile(program, playerId, position, tile, depth + 1, ctx),
  });
}

function applyTile(
  program: FrousseRaceProgram,
  playerId: number,
  position: number,
  tile: FrousseRaceProgram['tiles'][number] | undefined,
  depth: number,
  ctx: Context,
) {
  if (!tile) return;
  ctx.events.message('game.pawn.landed', { playerId, tileId: position });
  if (tile.type === 'finish')
    ctx.match.finish({ winners: [playerId], reason: program.finishReason });
  else if (tile.type === 'card') drawCard(program, playerId, depth, ctx);
}

function drawCard(
  program: FrousseRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  if (depth > program.maxChainDepth || pendingSwap(program, ctx)) return;
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    eventData: (card) => ({ category: card.category }),
    resolve: (card) => {
      if (!isProtected(program, playerId, card.category, ctx))
        ctx.effects.schedule(...card.effects);
    },
  });
}

function isProtected(
  program: FrousseRaceProgram,
  playerId: number,
  category: Card['category'],
  ctx: Context,
) {
  const statuses = program.statuses;
  const untilDraw = ctx.status.consume(
    playerId,
    statuses.ignoreTrapUntilNextDraw,
  );
  if (category === 'trap' && untilDraw) return true;
  if (
    category === 'trap' &&
    ctx.status.consume(playerId, statuses.ignoreNextTrap)
  )
    return true;
  if (
    category === 'prank' &&
    ctx.status.consume(playerId, statuses.ignoreNextPrank)
  )
    return true;
  return (
    category === 'ghost' &&
    ctx.status.consume(playerId, statuses.ignoreNextGhost)
  );
}

function frousseEffects(program: FrousseRaceProgram) {
  return {
    'frousse.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveAndResolve(program, actorPlayerId, data.delta, 0, ctx);
      },
    }),
    'frousse.goto': defineEffect<State, { position: number }>({
      input: gameInput.object({
        position: gameInput.number({ integer: true, min: 0 }),
      }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        ctx.movement.moveTo(program.trackId, actorPlayerId, data.position);
        ctx.movement.resolveLanding({
          trackId: program.trackId,
          playerId: actorPlayerId,
          tiles: program.tiles,
          maxDepth: program.maxChainDepth,
          blocked: () =>
            ctx.match.lifecycle() === 'finished' || pendingSwap(program, ctx),
          onLand: ({ position, tile }) =>
            applyTile(program, actorPlayerId, position, tile, 0, ctx),
        });
      },
    }),
    'frousse.swap': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId != null && target != null)
          ctx.movement.swap(program.trackId, actorPlayerId, target);
      },
    }),
    'frousse.move-others': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const target of targetPlayerIds)
          moveAndResolve(program, target, data.delta, 0, ctx);
      },
    }),
  };
}

function pendingSwap(program: FrousseRaceProgram, ctx: Context) {
  return ctx.choice.current()?.data?.choiceId === program.swapChoiceId;
}

function blockedRule(
  program: FrousseRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const value = ctx.status.get(playerId, program.statuses.blocked)?.data.rule;
  return isBlock(value) ? value : null;
}

function isBlock(value: unknown): value is FrousseBlock {
  if (value == null || typeof value !== 'object' || !('kind' in value))
    return false;
  if (value.kind === 'even') return true;
  if (value.kind === 'minimum')
    return 'minimum' in value && typeof value.minimum === 'number';
  return (
    value.kind === 'one-of' &&
    'allowed' in value &&
    Array.isArray(value.allowed) &&
    value.allowed.every((candidate) => typeof candidate === 'number')
  );
}

function passesBlock(value: number, block: FrousseBlock) {
  if (block.kind === 'one-of') return block.allowed.includes(value);
  if (block.kind === 'minimum') return value >= block.minimum;
  return value % 2 === 0;
}

function statusNumber(
  _program: FrousseRaceProgram,
  playerId: number,
  statusId: string,
  ctx: Context,
) {
  const value = ctx.status.get(playerId, statusId)?.data.value;
  return typeof value === 'number' ? value : 0;
}
