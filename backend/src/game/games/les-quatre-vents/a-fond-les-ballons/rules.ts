import {
  defineEffect,
  drawAndResolve,
  drawEvent,
  gameEffects,
  gameInput,
  rollDice,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import {
  A_FOND_LES_BALLONS_CARDS,
  A_FOND_LES_BALLONS_TILES,
  type BalloonCard,
  type BalloonTileType,
} from './content';
import type { AFondLesBallonsState } from './state';

type RuleContext = GameContext<AFondLesBallonsState>;
export const A_FOND_LES_BALLONS_PHASES =
  setupPlayingPhases<AFondLesBallonsState>();
const TRACK = 'balloons';
const DECK = 'loufoque';
const MAX_DEPTH = 12;
const TRAP_IMMUNITY = 'a-fond-les-ballons.trap-immunity';

export const roll = rollDice<AFondLesBallonsState>({
  documentation: 'Lance le dé et résout toute la chaîne de cases et cartes.',
  available: ({ ctx }) => A_FOND_LES_BALLONS_PHASES.is(ctx, 'playing'),
  execute: ({ state, playerId, total, ctx }) => {
    moveBy(state, playerId, total, 0, ctx);
    ctx.turn.complete({ waiting: ctx.choice.current() != null });
  },
});

export const A_FOND_LES_BALLONS_ACTIONS = { roll };

const pawnSelection = sequentialPawnSelection<AFondLesBallonsState>({
  setId: 'balloons',
  choiceId: 'a-fond-les-ballons.pawn',
  complete: ({ ctx }) => {
    A_FOND_LES_BALLONS_PHASES.transition(ctx, 'playing');
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export const requestPawn = pawnSelection.request;
export const resolvePawn = pawnSelection.resolve;

function applySwap(actorId: number, targetId: number, ctx: RuleContext): void {
  ctx.movement.swap(TRACK, actorId, targetId);
  ctx.events.message('game.positions.swapped', { actorId, targetId });
}

function moveBy(
  state: AFondLesBallonsState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.match.lifecycle() === 'finished') return;
  ctx.movement.moveAndResolve({
    trackId: TRACK,
    playerId,
    distance: delta,
    depth: depth + 1,
    maxDepth: MAX_DEPTH,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position }) =>
      resolveLandedTile(state, playerId, position, depth + 1, ctx),
  });
}

function landOn(
  state: AFondLesBallonsState,
  playerId: number,
  target: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.match.lifecycle() === 'finished') return;
  ctx.movement.moveTo(TRACK, playerId, target);
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    depth,
    maxDepth: MAX_DEPTH,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position }) =>
      resolveLandedTile(state, playerId, position, depth, ctx),
  });
}

function resolveLandedTile(
  state: AFondLesBallonsState,
  playerId: number,
  target: number,
  depth: number,
  ctx: RuleContext,
): void {
  const tile = A_FOND_LES_BALLONS_TILES[target];
  ctx.events.message('game.pawn.landed', { playerId, tileId: target });
  if (tile.type === 'finish') {
    ctx.match.finish({ winners: [playerId], reason: 'golden-nut' });
  } else if (tile.type === 'bonus') moveBy(state, playerId, 2, depth, ctx);
  else if (tile.type === 'piege') {
    if (ctx.status.has(playerId, TRAP_IMMUNITY)) {
      ctx.events.message('a-fond-les-ballons.trap.ignored', { playerId });
    } else {
      moveBy(state, playerId, -2, depth, ctx);
    }
  } else if (tile.type === 'glissade') {
    const magnitude = ctx.random.int(3) + 1;
    const direction = ctx.random.int(2) === 0 ? 1 : -1;
    moveBy(state, playerId, magnitude * direction, depth, ctx);
  } else if (tile.type === 'tornade') {
    ctx.effects.schedule(
      gameEffects.custom(
        'a-fond-les-ballons.swap',
        {},
        gameEffects.target.chosenOpponent('a-fond-les-ballons.swap', true),
      ),
      gameEffects.completeTurn(),
    );
  } else if (tile.type === 'chaton') landOn(state, playerId, 0, depth + 1, ctx);
  else if (tile.type === 'folie') drawBalloonCard(state, playerId, depth, ctx);
}

function drawBalloonCard(
  _state: AFondLesBallonsState,
  playerId: number,
  _depth: number,
  ctx: RuleContext,
): void {
  drawAndResolve<AFondLesBallonsState, BalloonCard>(ctx, {
    deckId: DECK,
    playerId,
    resolve: (card) => {
      ctx.effects.schedule(...card.effects);
    },
  });
}

function moveToNextTile(
  state: AFondLesBallonsState,
  playerId: number,
  type: BalloonTileType,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const next = A_FOND_LES_BALLONS_TILES.findIndex(
    (tile, index) => index > current && tile.type === type,
  );
  if (next >= 0) landOn(state, playerId, next, depth + 1, ctx);
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function applyBoutique(playerId: number, ctx: RuleContext): void {
  const cards = [
    drawEvent<AFondLesBallonsState, BalloonCard>(ctx, {
      deckId: DECK,
      playerId,
      recycle: true,
    }),
    drawEvent<AFondLesBallonsState, BalloonCard>(ctx, {
      deckId: DECK,
      playerId,
      recycle: true,
    }),
  ].filter((card): card is BalloonCard => card != null);
  const selected = cards.sort(
    (left, right) => left.retreatScore - right.retreatScore,
  )[0];
  if (!selected) return;
  ctx.events.message('a-fond-les-ballons.shop.card-selected', {
    playerId,
    cardId: selected.id,
  });
  ctx.effects.schedule(...selected.effects);
}

export const A_FOND_LES_BALLONS_EFFECTS = {
  'a-fond-les-ballons.move': defineEffect<
    AFondLesBallonsState,
    { delta: number }
  >({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        moveBy(state, playerId, data.delta, 0, ctx);
      }
    },
  }),
  'a-fond-les-ballons.next-tile': defineEffect<
    AFondLesBallonsState,
    { tile: 'bonus' | 'folie' }
  >({
    input: gameInput.object({
      tile: gameInput.enum(['bonus', 'folie'] as const),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveToNextTile(state, actorPlayerId, data.tile, 0, ctx);
      }
    },
  }),
  'a-fond-les-ballons.repeat-roll': defineEffect<
    AFondLesBallonsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const delta = ctx.dice.last('main')?.total ?? 0;
      for (const playerId of targetPlayerIds) {
        moveBy(state, playerId, delta, 0, ctx);
      }
    },
  }),
  'a-fond-les-ballons.swap': defineEffect<
    AFondLesBallonsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        applySwap(actorPlayerId, targetId, ctx);
      }
    },
  }),
  'a-fond-les-ballons.go-to': defineEffect<
    AFondLesBallonsState,
    { position: number }
  >({
    input: gameInput.object({
      position: gameInput.number({ integer: true, min: 0 }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        landOn(state, actorPlayerId, data.position, 0, ctx);
      }
    },
  }),
  'a-fond-les-ballons.boutique': defineEffect<
    AFondLesBallonsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) applyBoutique(actorPlayerId, ctx);
    },
  }),
  'a-fond-les-ballons.random-move': defineEffect<
    AFondLesBallonsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      for (const playerId of targetPlayerIds) {
        moveBy(state, playerId, ctx.random.int(2) === 0 ? -1 : 1, 0, ctx);
      }
    },
  }),
  'a-fond-les-ballons.finish-if-slide': defineEffect<
    AFondLesBallonsState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, ctx }) => {
      if (
        actorPlayerId != null &&
        A_FOND_LES_BALLONS_TILES[position(actorPlayerId, ctx)].type ===
          'glissade'
      ) {
        landOn(
          state,
          actorPlayerId,
          A_FOND_LES_BALLONS_TILES.length - 1,
          0,
          ctx,
        );
      }
    },
  }),
} as const;

export const A_FOND_CARD_COUNT = A_FOND_LES_BALLONS_CARDS.length;
