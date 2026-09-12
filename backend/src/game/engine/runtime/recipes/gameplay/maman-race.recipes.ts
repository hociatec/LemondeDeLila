import type {
  MamanRaceProgram,
  MamanTileType,
} from '../../extensions/maman-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import { drawAndResolve } from './card-dice.recipes';
import type { GameEffectInstruction } from '../../contracts/effect-ir';

type State = Record<string, never>;
type Context = GameContext<State>;

export function mamanRaceRules(source: MamanRaceProgram) {
  const program = structuredClone(source);
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        const extraDice = ctx.status.consume(
          actor.id,
          program.bonusRerollStatus,
        )
          ? 1
          : 0;
        const total = ctx.dice.rollWith(program.diceId, { extraDice }).total;
        const last = program.tiles.length - 1;
        const current = ctx.movement.position(program.trackId, actor.id);
        const rawTarget = current + total;
        const target =
          rawTarget > last ? Math.max(0, last - (rawTarget - last)) : rawTarget;
        setPosition(program, actor.id, target, ctx);
        ctx.events.message('game.pawn.moved', {
          playerId: actor.id,
          distance: total,
          target,
        });
        applyTile(program, actor.id, target, 0, ctx);
        if (
          ctx.match.lifecycle() !== 'finished' &&
          ctx.choice.current() == null
        )
          ctx.turn.end();
      },
      documentation: 'Lance le dé et résout la chaîne d’effets de la forêt.',
    }),
    effects: mamanEffects(program),
  };
}
function applyTile(
  program: MamanRaceProgram,
  playerId: number,
  position: number,
  depth: number,
  ctx: Context,
): void {
  if (depth > program.maxDepth || ctx.choice.current() != null) return;
  const tile = program.tiles[position];
  if (!tile) return;
  if (tile.type === 'start') gain(program, playerId, 2, ctx);
  else if (tile.type === 'token') gain(program, playerId, 1, ctx);
  else if (tile.type === 'card') drawCard(program, playerId, ctx);
  else if (tile.type === 'bonds')
    moveAndApply(program, playerId, 2, depth + 1, ctx);
  else if (tile.type === 'slide')
    moveAndApply(program, playerId, -2, depth + 1, ctx);
  else if (tile.type === 'storm' || tile.type === 'nest')
    ctx.turn.skip(playerId, 1);
  else if (tile.type === 'meeting')
    ctx.effects.schedule(
      {
        kind: 'custom',
        effectId: 'maman.meeting',
        data: {},
        target: {
          kind: 'chosen-opponent',
          optional: false,
          choiceId: 'maman.meeting',
        },
      },
      { kind: 'complete-turn' },
    );
  else if (tile.type === 'finish')
    finishOrRewind(program, playerId, position, depth + 1, ctx);
}

function drawCard(
  program: MamanRaceProgram,
  playerId: number,
  ctx: Context,
): void {
  drawAndResolve<
    State,
    { id: number; effects: readonly GameEffectInstruction[] }
  >(ctx, {
    deckId: program.deckId,
    playerId,
    resolve: (card) => ctx.effects.schedule(...card.effects),
  });
}

function moveAndApply(
  program: MamanRaceProgram,
  playerId: number,
  delta: number,
  depth: number,
  ctx: Context,
): void {
  if (ctx.choice.current() != null) return;
  const position = ctx.movement.move(program.trackId, playerId, delta);
  applyTile(program, playerId, position, depth, ctx);
}

function moveToType(
  program: MamanRaceProgram,
  playerId: number,
  type: MamanTileType,
  direction: 1 | -1,
  ctx: Context,
): void {
  let index = ctx.movement.position(program.trackId, playerId) + direction;
  while (index >= 0 && index < program.tiles.length) {
    if (program.tiles[index]?.type === type) {
      setPosition(program, playerId, index, ctx);
      applyTile(program, playerId, index, 0, ctx);
      return;
    }
    index += direction;
  }
}

function finishOrRewind(
  program: MamanRaceProgram,
  playerId: number,
  position: number,
  depth: number,
  ctx: Context,
): void {
  const tokens = ctx.resources.get(playerId, program.tokenResource);
  if (tokens >= program.tokensToWin) {
    ctx.match.finish({ winners: [playerId], reason: program.finishReason });
    return;
  }
  const rewind = Math.min(position, program.tokensToWin - tokens);
  setPosition(program, playerId, position - rewind, ctx);
  applyTile(program, playerId, position - rewind, depth, ctx);
}

function setPosition(
  program: MamanRaceProgram,
  playerId: number,
  position: number,
  ctx: Context,
): void {
  const current = ctx.movement.position(program.trackId, playerId);
  ctx.movement.move(program.trackId, playerId, position - current);
}

function gain(
  program: MamanRaceProgram,
  playerId: number,
  amount: number,
  ctx: Context,
): void {
  ctx.resources.add(playerId, program.tokenResource, amount);
}

function mamanEffects(program: MamanRaceProgram) {
  return {
    'maman.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          moveAndApply(program, playerId, data.delta, 0, ctx);
      },
    }),
    'maman.move-to-type': defineEffect<
      State,
      { type: 'card' | 'token' | 'bonds'; direction: 'forward' | 'backward' }
    >({
      input: gameInput.object({
        type: gameInput.enum(['card', 'token', 'bonds']),
        direction: gameInput.enum(['forward', 'backward']),
      }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveToType(
            program,
            actorPlayerId,
            data.type,
            data.direction === 'forward' ? 1 : -1,
            ctx,
          );
      },
    }),
    'maman.transfer-token': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (
          actorPlayerId != null &&
          targetId != null &&
          ctx.resources.has(actorPlayerId, program.tokenResource, 1)
        )
          ctx.resources.transfer(
            actorPlayerId,
            targetId,
            program.tokenResource,
            1,
          );
      },
    }),
    'maman.share-advance': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (targetId != null) moveAndApply(program, targetId, 1, 0, ctx);
      },
    }),
    'maman.meeting': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        if (actorPlayerId != null)
          moveAndApply(program, actorPlayerId, 1, 0, ctx);
        const targetId = targetPlayerIds[0];
        if (targetId != null && ctx.match.lifecycle() !== 'finished')
          moveAndApply(program, targetId, 1, 0, ctx);
      },
    }),
    'maman.roll-move': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          moveAndApply(
            program,
            actorPlayerId,
            ctx.dice.roll(program.diceId).total,
            0,
            ctx,
          );
      },
    }),
    'maman.roll-threshold-move': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null && ctx.dice.roll(program.diceId).total >= 4)
          moveAndApply(program, actorPlayerId, 1, 0, ctx);
      },
    }),
  };
}
