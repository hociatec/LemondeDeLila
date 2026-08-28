import {
  defineAction,
  defineEffect,
  drawAndResolve,
  gameInput,
  positionOf,
  rejectRule,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { MINUIT_CARDS, MINUIT_TILES, type MinuitCard } from './content';
import type { MinuitPending, MinuitState } from './state';

type RuleContext = GameContext<MinuitState>;
export const MINUIT_PHASES = setupPlayingPhases<MinuitState>();
const TRACK = 'minuit';
const DECK = 'noel';
const MAX_DEPTH = 24;
const IGNORE_NEXT_MALUS = 'minuit.ignore-next-malus';
const IGNORE_NEXT_SKIP = 'minuit.ignore-next-skip';
const FORCE_DRAW_NEXT_TURN = 'minuit.force-draw-next-turn';

export const roll = defineAction<MinuitState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Lance le dé ou applique la pioche forcée, puis résout la case.',
  available: ({ ctx }) => MINUIT_PHASES.is(ctx, 'playing'),
  execute: ({ state, actor, ctx }) => {
    if (ctx.status.consume(actor.id, FORCE_DRAW_NEXT_TURN)) {
      drawMinuitCard(state, actor.id, 0, ctx);
    } else {
      const value = ctx.dice.roll('main').total;
      ctx.events.message('game.dice.rolled', {
        playerId: actor.id,
        diceId: 'main',
        total: value,
      });
      moveMinuitAndResolve(state, actor.id, value, 0, ctx);
    }
    ctx.turn.complete({ waiting: ctx.choice.current() != null });
  },
});

export const MINUIT_ACTIONS = { roll };

const pawnSelection = sequentialPawnSelection<MinuitState>({
  setId: 'minuit',
  choiceId: 'minuit.pawn',
  complete: ({ ctx }) => {
    MINUIT_PHASES.transition(ctx, 'playing');
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export const requestPawn = pawnSelection.request;
export const resolvePawn = pawnSelection.resolve;

export function resolvePending(
  state: MinuitState,
  value: number,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<MinuitPending>();
  if (!pending) rejectRule('Choix Minuit absent');
  if (pending.kind === 'quiz') {
    const card = MINUIT_CARDS.find(
      (candidate) => candidate.id === pending.cardId,
    );
    if (!card?.quiz) {
      rejectRule('Question Minuit inconnue');
    }
    const quiz = card.quiz;
    if (!Number.isInteger(value) || value < 0 || value >= quiz.choices.length) {
      rejectRule('Réponse Minuit invalide');
    }
    const correct = (quiz.anyCorrect ?? false) || value === quiz.correctIndex;
    moveMinuitAndResolve(
      state,
      pending.actorId,
      correct ? quiz.successDelta : quiz.failureDelta,
      0,
      ctx,
    );
  }
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

function moveMinuitAndResolve(
  state: MinuitState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.movement.moveAndResolve({
    trackId: TRACK,
    playerId,
    distance: delta,
    tiles: MINUIT_TILES,
    depth: depth + 1,
    maxDepth: MAX_DEPTH,
    blocked: () =>
      ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
    onLand: () => applyMinuitTile(state, playerId, depth + 1, ctx),
  });
}

function resolveMinuitDestination(
  state: MinuitState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: MINUIT_TILES,
    depth,
    maxDepth: MAX_DEPTH,
    blocked: () =>
      ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
    onLand: () => applyMinuitTile(state, playerId, depth, ctx),
  });
}

function applyMinuitTile(
  state: MinuitState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  let current = positionOf(ctx, TRACK, playerId);
  const occupied = ctx.players
    .all()
    .some(
      (player) =>
        player.id !== playerId && positionOf(ctx, TRACK, player.id) === current,
    );
  if (occupied) {
    ctx.movement.moveTo(TRACK, playerId, Math.max(0, current - 1));
    current = positionOf(ctx, TRACK, playerId);
  }
  const tile = MINUIT_TILES[current];
  ctx.events.message('game.pawn.landed', { playerId, tileId: current });
  if (tile.type === 'finish') {
    ctx.match.finish({ winners: [playerId], reason: 'midnight' });
  } else if (tile.type === 'move') {
    if (!(tile.delta < 0 && ctx.status.consume(playerId, IGNORE_NEXT_MALUS))) {
      moveMinuitAndResolve(state, playerId, tile.delta, depth, ctx);
    }
  } else if (tile.type === 'skip') {
    if (ctx.status.consume(playerId, IGNORE_NEXT_SKIP)) return;
    ctx.turn.skip(playerId, tile.skipTurns);
  } else if (tile.type === 'card') drawMinuitCard(state, playerId, depth, ctx);
}

function drawMinuitCard(
  _state: MinuitState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.choice.current()) return;
  drawAndResolve<MinuitState, MinuitCard>(ctx, {
    deckId: DECK,
    playerId,
    resolve: (card) => applyCard(playerId, card, ctx),
  });
}

function applyCard(playerId: number, card: MinuitCard, ctx: RuleContext): void {
  if (card.quiz) {
    const pending: MinuitPending = {
      kind: 'quiz',
      actorId: playerId,
      cardId: card.id,
    };
    ctx.choice.one({
      id: 'minuit.resolve',
      player: playerId,
      options: card.quiz.choices.map((_choice, index) => index),
      data: pending,
      label: (index) => card.quiz?.choices[index] ?? String(index),
    });
    return;
  }
  ctx.effects.schedule(...card.effects);
}

function applyCardMove(
  state: MinuitState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (delta < 0 && ctx.status.consume(playerId, IGNORE_NEXT_MALUS)) {
    return;
  }
  moveMinuitAndResolve(state, playerId, delta, depth, ctx);
}

function moveToTypedTile(
  state: MinuitState,
  playerId: number,
  type: 'card' | 'neutral',
  direction: 1 | -1,
  depth: number,
  ctx: RuleContext,
): void {
  const current = positionOf(ctx, TRACK, playerId);
  const candidates = MINUIT_TILES.filter(
    (tile, index) =>
      tile.type === type &&
      (direction === 1 ? index > current : index < current),
  );
  const selected = direction === 1 ? candidates[0] : candidates.at(-1);
  if (!selected) return;
  ctx.movement.moveTo(TRACK, playerId, selected.n - 1);
  resolveMinuitDestination(state, playerId, depth + 1, ctx);
}

export function applyGift(
  state: MinuitState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  moveDirect(targetId, 1, ctx);
  moveMinuitAndResolve(state, actorId, 2, 0, ctx);
}

export function applySwap(
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  ctx.movement.swap(TRACK, actorId, targetId);
}

function swapWithBehind(actorId: number, ctx: RuleContext): void {
  const actorPosition = positionOf(ctx, TRACK, actorId);
  const behind = ctx.players
    .all()
    .filter(
      (player) =>
        player.id !== actorId &&
        positionOf(ctx, TRACK, player.id) < actorPosition,
    )
    .sort(
      (left, right) =>
        positionOf(ctx, TRACK, right.id) - positionOf(ctx, TRACK, left.id),
    )[0];
  if (behind) ctx.movement.swap(TRACK, actorId, behind.id);
}

function moveDirect(playerId: number, delta: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, delta);
}

export const MINUIT_EFFECTS = {
  'minuit.move': defineEffect<MinuitState, { delta: number }>({
    input: gameInput.object({
      delta: gameInput.number({ integer: true }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        applyCardMove(state, actorPlayerId, data.delta, 0, ctx);
      }
    },
  }),
  'minuit.roll': defineEffect<MinuitState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, ctx }) => {
      if (actorPlayerId != null) {
        moveMinuitAndResolve(
          state,
          actorPlayerId,
          ctx.dice.roll('main').total,
          0,
          ctx,
        );
      }
    },
  }),
  'minuit.move-to-type': defineEffect<
    MinuitState,
    { type: 'card' | 'neutral'; direction: 'forward' | 'backward' }
  >({
    input: gameInput.object({
      type: gameInput.enum(['card', 'neutral'] as const),
      direction: gameInput.enum(['forward', 'backward'] as const),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveToTypedTile(
          state,
          actorPlayerId,
          data.type,
          data.direction === 'forward' ? 1 : -1,
          0,
          ctx,
        );
      }
    },
  }),
  'minuit.gift': defineEffect<MinuitState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        applyGift(state, actorPlayerId, targetId, ctx);
      }
    },
  }),
  'minuit.swap': defineEffect<MinuitState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        applySwap(actorPlayerId, targetId, ctx);
      }
    },
  }),
  'minuit.swap-behind': defineEffect<MinuitState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) swapWithBehind(actorPlayerId, ctx);
    },
  }),
} as const;
