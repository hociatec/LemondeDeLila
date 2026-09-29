import { defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineEffect,
  defineEmptyEffect,
  drawAndResolve,
  sequentialPawnSelection,
} from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

export type ProtectedHauntedBlock =
  | { kind: 'one-of'; allowed: number[] }
  | { kind: 'minimum'; minimum: number }
  | { kind: 'even' };
export type ProtectedHauntedRaceProgram = {
  rollRecipe: string;
  trackId: string;
  diceId: string;
  finishReason: string;
  conditionalMove: { equals: number; delta: number };
  protections: readonly {
    category: string;
    status: string;
    consume: 'draw' | 'matching-card';
  }[];
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  swapChoiceId: string;
  maxChainDepth: number;
  eventNamespace: string;
  statuses: {
    ignoreNextTrap: string;
    ignoreTrapUntilNextDraw: string;
    ignoreNextPrank: string;
    ignoreNextGhost: string;
    nextMoveCap: string;
    nextRollMalus: string;
    nextRollKeepLowest: string;
    nextRollDouble: string;
    nextRollIfThreeBackTwo: string;
    blocked: string;
  };
  tiles: readonly {
    n: number;
    title: string;
    label: string;
    description: string;
    type: 'neutral' | 'card' | 'finish';
  }[];
  cards: readonly {
    id: number;
    localNumber: number;
    category: string;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = ProtectedHauntedRaceProgram['cards'][number];

export function protectedHauntedRace(source: ProtectedHauntedRaceProgram) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    completePhase: 'playing',
  });
  return definePattern({
    id: `protected-haunted-race:${program.trackId}`,
    mechanics: ['race', 'cards', 'protection', 'pawns', 'effects'],
    actions: {
      [program.rollRecipe]: defineEmptyAction<State>({
        available: ({ ctx }) =>
          ctx.phase.current() === 'playing' && !pendingSwap(program, ctx),
        execute: ({ actor, ctx }) => executeRoll(program, actor.id, ctx),
        documentation:
          'Lance le dé, applique les altérations puis résout la case.',
      }),
    },
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: pawns.choice,
    },
    effects: protectedHauntedEffects(program),
    bot: {
      choose: ({ availableActions }) =>
        availableActions.includes(program.rollRecipe)
          ? { type: program.rollRecipe, payload: {} }
          : null,
    },
  });
}
function executeRoll(
  program: ProtectedHauntedRaceProgram,
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
    if (value === program.conditionalMove.equals)
      moveAndResolve(program, playerId, program.conditionalMove.delta, 0, ctx);
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
  program: ProtectedHauntedRaceProgram,
  playerId: number,
  ctx: Context,
) {
  let value: number;
  if (ctx.status.consume(playerId, program.statuses.nextRollKeepLowest)) {
    // Keep this as one dice operation. Two individual rolls each emit a raw
    // dice event, which made the history announce the same turn twice.
    value = ctx.dice.rollWith(program.diceId, {
      attempts: 2,
      select: 'worst',
    }).total;
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
  program: ProtectedHauntedRaceProgram,
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
  program: ProtectedHauntedRaceProgram,
  playerId: number,
  position: number,
  tile: ProtectedHauntedRaceProgram['tiles'][number] | undefined,
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
  program: ProtectedHauntedRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  if (depth > program.maxChainDepth || pendingSwap(program, ctx)) return;
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    automatic: false,
    // These cards contain their full rule in the narrative. Do not append a
    // second, derived description (which can expose internal status names).
    eventData: (card) => ({ category: card.category, effectDescription: '' }),
    resolve: (card) => {
      if (!isProtected(program, playerId, card.category, ctx))
        ctx.effects.schedule(...card.effects);
    },
  });
}

function isProtected(
  program: ProtectedHauntedRaceProgram,
  playerId: number,
  category: Card['category'],
  ctx: Context,
) {
  for (const protection of program.protections) {
    const matches = category === protection.category;
    const active =
      protection.consume === 'draw' || matches
        ? ctx.status.consume(playerId, protection.status)
        : false;
    if (matches && active) return true;
  }
  return false;
}

function protectedHauntedEffects(program: ProtectedHauntedRaceProgram) {
  return {
    'protectedHaunted.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveAndResolve(program, actorPlayerId, data.delta, 0, ctx);
      },
    }),
    'protectedHaunted.goto': defineEffect<State, { position: number }>({
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
    'protectedHaunted.swap': defineEmptyEffect<State>(
      ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId != null && target != null)
          ctx.movement.swap(program.trackId, actorPlayerId, target);
      },
    ),
    'protectedHaunted.move-others': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const target of targetPlayerIds)
          moveAndResolve(program, target, data.delta, 0, ctx);
      },
    }),
  };
}

function pendingSwap(program: ProtectedHauntedRaceProgram, ctx: Context) {
  return ctx.choice.current()?.data?.choiceId === program.swapChoiceId;
}

function blockedRule(
  program: ProtectedHauntedRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const value = ctx.status.get(playerId, program.statuses.blocked)?.data.rule;
  return isBlock(value) ? value : null;
}

function isBlock(value: unknown): value is ProtectedHauntedBlock {
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

function passesBlock(value: number, block: ProtectedHauntedBlock) {
  if (block.kind === 'one-of') return block.allowed.includes(value);
  if (block.kind === 'minimum') return value >= block.minimum;
  return value % 2 === 0;
}

function statusNumber(
  _program: ProtectedHauntedRaceProgram,
  playerId: number,
  statusId: string,
  ctx: Context,
) {
  const value = ctx.status.get(playerId, statusId)?.data.value;
  return typeof value === 'number' ? value : 0;
}
