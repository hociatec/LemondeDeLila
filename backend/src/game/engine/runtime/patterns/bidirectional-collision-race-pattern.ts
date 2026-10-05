import { gameInput } from '../actions/game-input-schema';
import { defineEmptyAction } from '../actions/action-builders';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineEffect,
  defineEmptyEffect,
  drawAndResolve,
  rollDice,
  sequentialPawnSelection,
} from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

export type BidirectionalCollisionRegion = string;
export type BidirectionalCollisionRaceOptions = {
  rollRecipe: string;
  drawRecipe: string;
  pendingDrawFlag: string;
  trackId: string;
  diceId: string;
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  appleResource: string;
  iouPrefix: string;
  returningStatus: string;
  applesToWin: number;
  maxDepth: number;
  finishReason: string;
  tiles: readonly {
    n: number;
    type: 'start' | 'neutral' | 'card' | 'bonus' | 'skip' | 'finish';
    region: BidirectionalCollisionRegion;
    apples?: number;
    skipTurns?: number;
    [key: string]: unknown;
  }[];
  cards: readonly {
    id: number;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = BidirectionalCollisionRaceOptions['cards'][number];
type PendingDraw = { playerId: number; depth: number };

export function bidirectionalCollisionRace(
  source: BidirectionalCollisionRaceOptions,
) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    completePhase: 'playing',
  });
  return definePattern({
    id: `bidirectional-collision-race:${program.trackId}`,
    mechanics: ['race', 'cards', 'resources', 'pawns', 'effects'],
    actions: {
      [program.rollRecipe]: rollDice<State>({
        diceId: program.diceId,
        available: ({ ctx }) =>
          ctx.phase.current() === 'playing' &&
          pendingDraws(program, ctx).length === 0,
        execute: ({ playerId, total, ctx }) => {
          payIou(program, playerId, ctx);
          moveAndResolve(program, playerId, total, 0, ctx);
          ctx.turn.complete({ waiting: pendingDraws(program, ctx).length > 0 });
        },
        documentation:
          'Paie les dettes, lance le dé et résout la case équestre.',
      }),
      [program.drawRecipe]: defineEmptyAction<State>({
        ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
        available: ({ actor, ctx }) =>
          ctx.phase.current() === 'playing' &&
          ctx.players.current()?.id === actor.id &&
          pendingDraws(program, ctx)[0]?.playerId === actor.id,
        execute: ({ ctx }) => {
          const [pending, ...remaining] = pendingDraws(program, ctx);
          if (!pending)
            return ctx.reject('BIDIRECTIONAL_RACE_DRAW_NOT_PENDING');
          if (remaining.length > 0)
            ctx.turn.flags.set(program.pendingDrawFlag, remaining);
          else ctx.turn.flags.consume(program.pendingDrawFlag);
          drawCard(program, pending.playerId, pending.depth, ctx);
          ctx.turn.complete({
            waiting:
              ctx.choice.current() != null ||
              pendingDraws(program, ctx).length > 0,
          });
        },
        documentation:
          'Pioche et résout manuellement la carte demandée par la case.',
      }),
    },
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: pawns.choice,
    },
    effects: effects(program),
    bot: {
      choose: ({ availableActions }) => {
        const type = [program.drawRecipe, program.rollRecipe].find((recipe) =>
          availableActions.includes(recipe),
        );
        return type ? { type, payload: {} } : null;
      },
    },
  });
}
function moveAndResolve(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  delta: number,
  depth: number,
  ctx: Context,
) {
  if (depth > program.maxDepth || ctx.match.lifecycle() === 'finished') return;
  moveHorse(program, playerId, delta, ctx);
  resolveTile(program, playerId, depth + 1, ctx);
}

function moveHorse(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  delta: number,
  ctx: Context,
) {
  const finish = program.tiles.length - 1;
  const current = ctx.movement.position(program.trackId, playerId);
  const direction = movementDirection(program, playerId, ctx);
  const signed = delta < 0 ? -direction : direction;
  let target = current;
  let nextDirection = direction;
  for (let step = 0; step < Math.abs(Math.trunc(delta)); step += 1) {
    target += signed;
    if (target > finish) {
      target = finish - (target - finish);
      nextDirection = -1;
    } else if (target < 0) {
      target = -target;
      nextDirection = 1;
    }
  }
  if (direction === -1 && target === 0) nextDirection = 1;
  ctx.movement.moveTo(program.trackId, playerId, target);
  if (nextDirection === -1)
    ctx.status.add(playerId, program.returningStatus, { scope: 'until-used' });
  else ctx.status.remove(playerId, program.returningStatus);
}

function resolveTile(
  program: BidirectionalCollisionRaceOptions,
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
      if (tile.type === 'finish') {
        const apples = ctx.resources.add(playerId, program.appleResource, 1, {
          announce: false,
        });
        if (apples >= program.applesToWin)
          ctx.match.finish({
            winners: [playerId],
            reason: program.finishReason,
          });
        else
          ctx.status.add(playerId, program.returningStatus, {
            scope: 'until-used',
          });
        return;
      }
      const occupant = ctx.players
        .otherIds(playerId)
        .find((id) => ctx.movement.position(program.trackId, id) === position);
      if (occupant !== undefined) moveHorse(program, occupant, -5, ctx);
      if (tile.type === 'bonus' && tile.apples)
        ctx.resources.add(playerId, program.appleResource, tile.apples, {
          announce: false,
        });
      else if (tile.type === 'skip' && tile.skipTurns)
        ctx.turn.skip(playerId, tile.skipTurns);
      else if (tile.type === 'card') awaitDraw(program, playerId, depth, ctx);
    },
  });
}

function pendingDraws(
  program: BidirectionalCollisionRaceOptions,
  ctx: Context,
): PendingDraw[] {
  const value = ctx.turn.flags.get(program.pendingDrawFlag);
  if (!Array.isArray(value)) return [];
  const draws: unknown[] = value;
  return draws.filter(
    (draw): draw is PendingDraw =>
      draw != null &&
      typeof draw === 'object' &&
      'playerId' in draw &&
      typeof (draw as Record<string, unknown>).playerId === 'number' &&
      'depth' in draw &&
      typeof (draw as Record<string, unknown>).depth === 'number',
  );
}

function awaitDraw(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  ctx.turn.flags.set(program.pendingDrawFlag, [
    ...pendingDraws(program, ctx),
    { playerId, depth },
  ]);
  ctx.events.message('game.card.draw-required', { playerId });
}

function drawCard(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  if (depth > program.maxDepth || ctx.choice.current() != null) return;
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    automatic: false,
    resolve: (card) => ctx.effects.schedule(...card.effects),
  });
}

function effects(program: BidirectionalCollisionRaceOptions) {
  const delta = gameInput.object({
    delta: gameInput.number({ integer: true }),
  });
  return {
    'bidirectionalCollision.move': defineEffect<State, { delta: number }>({
      input: delta,
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveAndResolve(program, actorPlayerId, data.delta, 0, ctx);
      },
    }),
    'bidirectionalCollision.move-to-region': defineEffect<
      State,
      { region: BidirectionalCollisionRegion }
    >({
      input: gameInput.object({
        region: gameInput.enum([
          ...new Set(program.tiles.map((tile) => tile.region)),
        ]),
      }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveToRegion(program, actorPlayerId, data.region, 0, ctx);
      },
    }),
    'bidirectionalCollision.give-apple': defineEmptyEffect<State>(
      ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId != null && target != null)
          giveApple(program, actorPlayerId, target, ctx);
      },
    ),
    'bidirectionalCollision.help-advance': defineEffect<
      State,
      { delta: number }
    >({
      input: delta,
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId != null && target != null) {
          moveAndResolve(program, target, data.delta, 0, ctx);
          if (ctx.resources.has(target, program.appleResource, 1))
            ctx.resources.transfer(
              target,
              actorPlayerId,
              program.appleResource,
              1,
              { announce: false },
            );
        }
      },
    }),
    'bidirectionalCollision.pair-advance': defineEffect<
      State,
      { delta: number }
    >({
      input: delta,
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId == null || target == null) return;
        moveAndResolve(program, actorPlayerId, data.delta, 0, ctx);
        if (ctx.match.lifecycle() !== 'finished')
          moveAndResolve(program, target, data.delta, 0, ctx);
      },
    }),
  };
}

function moveToRegion(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  region: BidirectionalCollisionRegion,
  depth: number,
  ctx: Context,
) {
  const current = ctx.movement.position(program.trackId, playerId);
  const direction = movementDirection(program, playerId, ctx);
  const target = program.tiles.findIndex(
    (tile, index) =>
      tile.region === region &&
      (direction === 1 ? index > current : index < current),
  );
  if (target < 0) return;
  ctx.movement.moveTo(program.trackId, playerId, target);
  resolveTile(program, playerId, depth + 1, ctx);
}

function giveApple(
  program: BidirectionalCollisionRaceOptions,
  actorId: number,
  targetId: number,
  ctx: Context,
) {
  if (!ctx.resources.has(actorId, program.appleResource, 1)) return;
  ctx.resources.transfer(actorId, targetId, program.appleResource, 1, {
    announce: false,
  });
  ctx.resources.add(targetId, iou(program, actorId), 1, { announce: false });
}

function payIou(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  ctx: Context,
) {
  const creditor = ctx.players
    .all()
    .map(({ id }) => id)
    .find((id) => ctx.resources.get(playerId, iou(program, id)) > 0);
  if (
    creditor == null ||
    !ctx.resources.has(playerId, program.appleResource, 1)
  )
    return;
  ctx.resources.transfer(playerId, creditor, program.appleResource, 1, {
    announce: false,
  });
  const debt = iou(program, creditor);
  ctx.resources.set(playerId, debt, ctx.resources.get(playerId, debt) - 1, {
    announce: false,
  });
}

function iou(program: BidirectionalCollisionRaceOptions, creditorId: number) {
  return `${program.iouPrefix}.${creditorId}`;
}

function movementDirection(
  program: BidirectionalCollisionRaceOptions,
  playerId: number,
  ctx: Context,
): 1 | -1 {
  return ctx.status.has(playerId, program.returningStatus) ? -1 : 1;
}
