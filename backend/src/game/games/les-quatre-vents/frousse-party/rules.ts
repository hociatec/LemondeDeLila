import {
  defineAction,
  defineEffect,
  gameInput,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import {
  FROUSSE_TILES,
  type FrousseBlock,
  type FrousseCard,
  type FrousseCategory,
} from './content';
import type { FrousseState } from './state';

type RuleContext = GameContext<FrousseState>;
export const FROUSSE_PHASES = setupPlayingPhases<FrousseState>();
const TRACK = 'manor';
const DECK = 'frights';
const MAX_CHAIN_DEPTH = 24;
export const FROUSSE_STATUSES = {
  ignoreNextTrap: 'frousse.ignore-next-trap',
  ignoreTrapUntilNextDraw: 'frousse.ignore-trap-until-next-draw',
  ignoreNextPrank: 'frousse.ignore-next-prank',
  ignoreNextGhost: 'frousse.ignore-next-ghost',
  nextMoveCap: 'frousse.next-move-cap',
  nextRollMalus: 'frousse.next-roll-malus',
  nextRollKeepLowest: 'frousse.next-roll-keep-lowest',
  nextRollDouble: 'frousse.next-roll-double',
  nextRollIfThreeBackTwo: 'frousse.next-roll-if-three-back-two',
  blocked: 'frousse.blocked',
} as const;

export const roll = defineAction<FrousseState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé, applique les altérations puis résout la case.',
  available: ({ ctx }) =>
    FROUSSE_PHASES.is(ctx, 'playing') && !pendingSwap(ctx),
  execute: ({ state, actor, ctx }) => {
    const blocked = blockedRule(actor.id, ctx);
    if (blocked) {
      const value = ctx.dice.roll('main').total;
      ctx.events.message('frousse.block.escape-attempted', {
        playerId: actor.id,
        value,
      });
      if (passesBlock(value, blocked)) {
        ctx.status.remove(actor.id, FROUSSE_STATUSES.blocked);
        ctx.events.message('frousse.block.escaped', { playerId: actor.id });
      }
      ctx.turn.end();
      return;
    }

    const value = modifiedRoll(actor.id, ctx);
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      total: value,
    });
    if (ctx.status.consume(actor.id, FROUSSE_STATUSES.nextRollIfThreeBackTwo)) {
      if (value === 3) moveAndLand(state, actor.id, -2, 0, ctx);
    }
    if (ctx.match.lifecycle() !== 'finished' && !pendingSwap(ctx)) {
      const cap = statusNumber(actor.id, FROUSSE_STATUSES.nextMoveCap, ctx);
      ctx.status.remove(actor.id, FROUSSE_STATUSES.nextMoveCap);
      moveAndLand(
        state,
        actor.id,
        cap > 0 ? Math.min(value, cap) : value,
        0,
        ctx,
      );
    }
    ctx.turn.complete({ waiting: pendingSwap(ctx) });
  },
});

export const FROUSSE_ACTIONS = { roll };

const pawnSelection = sequentialPawnSelection<FrousseState>({
  setId: 'frousse',
  choiceId: 'frousse.pawn',
  complete: ({ ctx }) => {
    FROUSSE_PHASES.transition(ctx, 'playing');
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export const requestPawn = pawnSelection.request;
export const resolvePawn = pawnSelection.resolve;

function modifiedRoll(
  playerId: number,
  ctx: RuleContext,
): number {
  let value: number;
  if (ctx.status.consume(playerId, FROUSSE_STATUSES.nextRollKeepLowest)) {
    const first = ctx.dice.roll('main').total;
    const second = ctx.dice.roll('main').total;
    value = Math.min(first, second);
  } else value = ctx.dice.roll('main').total;
  const malus = statusNumber(playerId, FROUSSE_STATUSES.nextRollMalus, ctx);
  ctx.status.remove(playerId, FROUSSE_STATUSES.nextRollMalus);
  if (ctx.status.consume(playerId, FROUSSE_STATUSES.nextRollDouble)) {
    value *= 2;
  }
  return Math.max(1, value + malus);
}

function passesBlock(value: number, block: FrousseBlock): boolean {
  if (block.kind === 'one-of') return block.allowed.includes(value);
  if (block.kind === 'minimum') return value >= block.minimum;
  return value % 2 === 0;
}

function moveAndLand(
  state: FrousseState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || ctx.match.lifecycle() === 'finished') return;
  ctx.movement.moveAndLand(TRACK, playerId, delta, () =>
    resolveLanding(state, playerId, depth + 1, ctx),
  );
}

function resolveLanding(
  state: FrousseState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (
    depth > MAX_CHAIN_DEPTH ||
    ctx.match.lifecycle() === 'finished' ||
    pendingSwap(ctx)
  )
    return;
  const tile = FROUSSE_TILES[position(playerId, ctx)];
  ctx.events.message('game.pawn.landed', {
    playerId,
    tileId: position(playerId, ctx),
  });
  if (tile.type === 'finish') {
    ctx.match.finish({ winners: [playerId], reason: 'escaped-manor' });
  }
  else if (tile.type === 'card') drawAndApply(state, playerId, depth, ctx);
}

function drawAndApply(
  state: FrousseState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || pendingSwap(ctx)) return;
  ctx.cards.drawThenResolve<FrousseCard, void>(
    DECK,
    (card) => {
      ctx.events.message('game.card.drawn', {
        playerId,
        deckId: DECK,
        cardId: card.id,
        category: card.category,
      });
      if (isProtected(playerId, card.category, ctx)) return;
      ctx.effects.schedule(...card.effects);
    },
    {},
  );
}

function isProtected(
  playerId: number,
  category: FrousseCategory,
  ctx: RuleContext,
): boolean {
  const untilDraw = ctx.status.consume(
    playerId,
    FROUSSE_STATUSES.ignoreTrapUntilNextDraw,
  );
  if (category === 'trap' && untilDraw) return true;
  if (
    category === 'trap' &&
    ctx.status.consume(playerId, FROUSSE_STATUSES.ignoreNextTrap)
  ) {
    return true;
  }
  if (
    category === 'prank' &&
    ctx.status.consume(playerId, FROUSSE_STATUSES.ignoreNextPrank)
  ) {
    return true;
  }
  if (
    category === 'ghost' &&
    ctx.status.consume(playerId, FROUSSE_STATUSES.ignoreNextGhost)
  ) {
    return true;
  }
  return false;
}

function pendingSwap(
  ctx: RuleContext,
): boolean {
  return ctx.choice.current()?.data.choiceId === 'frousse.swap';
}

function swapPositions(
  firstId: number,
  secondId: number,
  ctx: RuleContext,
): void {
  ctx.movement.swap(TRACK, firstId, secondId);
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

export function blockedRule(
  playerId: number,
  ctx: RuleContext,
): FrousseBlock | null {
  const value = ctx.status.get(playerId, FROUSSE_STATUSES.blocked)?.data.rule;
  return isFrousseBlock(value) ? value : null;
}

function isFrousseBlock(value: unknown): value is FrousseBlock {
  if (value == null || typeof value !== 'object') return false;
  if (!('kind' in value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'even') return true;
  if (value.kind === 'minimum') {
    return 'minimum' in value && typeof value.minimum === 'number';
  }
  return (
    value.kind === 'one-of' &&
    'allowed' in value &&
    Array.isArray(value.allowed) &&
    value.allowed.every((candidate) => typeof candidate === 'number')
  );
}

export function statusNumber(
  playerId: number,
  statusId: string,
  ctx: RuleContext,
): number {
  const value = ctx.status.get(playerId, statusId)?.data.value;
  return typeof value === 'number' ? value : 0;
}

export const FROUSSE_EFFECTS = {
  'frousse.move': defineEffect<FrousseState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveAndLand(state, actorPlayerId, data.delta, 0, ctx);
      }
    },
  }),
  'frousse.goto': defineEffect<FrousseState, { position: number }>({
    input: gameInput.object({
      position: gameInput.number({ integer: true, min: 0 }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId == null) return;
      ctx.movement.moveTo(TRACK, actorPlayerId, data.position);
      resolveLanding(state, actorPlayerId, 0, ctx);
    },
  }),
  'frousse.swap': defineEffect<FrousseState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        swapPositions(actorPlayerId, targetId, ctx);
      }
    },
  }),
  'frousse.move-others': defineEffect<FrousseState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      for (const targetId of targetPlayerIds) {
        moveAndLand(state, targetId, data.delta, 0, ctx);
      }
    },
  }),
} as const;
