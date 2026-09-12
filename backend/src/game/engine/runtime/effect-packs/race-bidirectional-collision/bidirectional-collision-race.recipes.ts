import type {
  BidirectionalCollisionRaceProgram,
  BidirectionalCollisionRegion,
} from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { defineEffect } from '../../effects/effects-core';
import {
  drawAndResolve,
  rollDice,
} from '../../recipes/gameplay/card-dice.recipes';
import { sequentialPawnSelection } from '../../recipes/gameplay/pawn-selection.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = BidirectionalCollisionRaceProgram['cards'][number];

export function bidirectionalCollisionRaceRules(
  source: BidirectionalCollisionRaceProgram,
) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    completePhase: 'playing',
  });
  return {
    roll: rollDice<State>({
      diceId: program.diceId,
      available: ({ ctx }) => ctx.phase.current() === 'playing',
      execute: ({ playerId, total, ctx }) => {
        payIou(program, playerId, ctx);
        moveAndResolve(program, playerId, total, 0, ctx);
        ctx.turn.complete();
      },
      documentation: 'Paie les dettes, lance le dé et résout la case équestre.',
    }),
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
    effects: effects(program),
  };
}
function moveAndResolve(
  program: BidirectionalCollisionRaceProgram,
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
  program: BidirectionalCollisionRaceProgram,
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
  program: BidirectionalCollisionRaceProgram,
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
        const apples = ctx.resources.add(playerId, program.appleResource, 1);
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
        .all()
        .find(
          (player) =>
            player.id !== playerId &&
            ctx.movement.position(program.trackId, player.id) === position,
        );
      if (occupant) moveHorse(program, occupant.id, -5, ctx);
      if (tile.type === 'bonus' && tile.apples)
        ctx.resources.add(playerId, program.appleResource, tile.apples);
      else if (tile.type === 'skip' && tile.skipTurns)
        ctx.turn.skip(playerId, tile.skipTurns);
      else if (tile.type === 'card') drawCard(program, playerId, depth, ctx);
    },
  });
}

function drawCard(
  program: BidirectionalCollisionRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  if (depth > program.maxDepth || ctx.choice.current() != null) return;
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    resolve: (card) => ctx.effects.schedule(...card.effects),
  });
}

function effects(program: BidirectionalCollisionRaceProgram) {
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
        region: gameInput.enum(['prairie', 'riviere', 'foret', 'montagne']),
      }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveToRegion(program, actorPlayerId, data.region, 0, ctx);
      },
    }),
    'bidirectionalCollision.give-apple': defineEffect<
      State,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId != null && target != null)
          giveApple(program, actorPlayerId, target, ctx);
      },
    }),
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
  program: BidirectionalCollisionRaceProgram,
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
  program: BidirectionalCollisionRaceProgram,
  actorId: number,
  targetId: number,
  ctx: Context,
) {
  if (!ctx.resources.has(actorId, program.appleResource, 1)) return;
  ctx.resources.transfer(actorId, targetId, program.appleResource, 1);
  ctx.resources.add(targetId, iou(program, actorId), 1);
}

function payIou(
  program: BidirectionalCollisionRaceProgram,
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
  ctx.resources.transfer(playerId, creditor, program.appleResource, 1);
  ctx.resources.remove(playerId, iou(program, creditor), 1);
}

function iou(program: BidirectionalCollisionRaceProgram, creditorId: number) {
  return `${program.iouPrefix}.${creditorId}`;
}

function movementDirection(
  program: BidirectionalCollisionRaceProgram,
  playerId: number,
  ctx: Context,
): 1 | -1 {
  return ctx.status.has(playerId, program.returningStatus) ? -1 : 1;
}
