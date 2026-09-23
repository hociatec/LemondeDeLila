import { gameInput, drawAndResolve } from '../../../engine/sdk/public-api';
import type {
  GameContext,
  GameEffectInstruction,
} from '../../../engine/sdk/public-api';
import type { PairedPawnRaceProgram, PairedPawnTileType } from './program';
import { defineEmptyAction } from '../../../engine/runtime/actions/action-builders';
import {
  defineEffect,
  defineEmptyEffect,
  defineActorEffect,
} from '../../../engine/runtime/effects/effects-core';

type State = Record<string, never>;
type Context = GameContext<State>;

export function pairedPawnRaceRules(source: PairedPawnRaceProgram) {
  const program = structuredClone(source);
  return {
    roll: defineEmptyAction<State>({
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
        setPosition(actor.id, target, ctx);
        ctx.events.message('game.pawn.moved', {
          playerId: actor.id,
          distance: total,
          target,
        });
        applyTile(actor.id, target, 0, ctx);
        if (
          ctx.match.lifecycle() !== 'finished' &&
          ctx.choice.current() == null
        )
          ctx.turn.end();
      },
      documentation: 'Lance le dé et résout la chaîne d’effets de la forêt.',
    }),
    effects: pairedPawnEffects(),
  };

  function applyTile(
    playerId: number,
    position: number,
    depth: number,
    ctx: Context,
  ): void {
    if (depth > program.maxDepth || ctx.choice.current() != null) return;
    const tile = program.tiles[position];
    if (!tile) return;
    const rule = program.tileRules[tile.type];
    if (rule.kind === 'gain') gain(playerId, rule.amount, ctx);
    else if (rule.kind === 'draw') drawCard(playerId, ctx);
    else if (rule.kind === 'move')
      moveAndApply(playerId, rule.amount, depth + 1, ctx);
    else if (rule.kind === 'skip') ctx.turn.skip(playerId, rule.amount);
    else if (rule.kind === 'meeting')
      ctx.effects.schedule(
        {
          kind: 'custom',
          effectId: 'pairedPawn.meeting',
          data: {},
          target: {
            kind: 'chosen-opponent',
            optional: false,
            choiceId: 'pairedPawn.meeting',
          },
        },
        { kind: 'complete-turn' },
      );
    else if (rule.kind === 'finish')
      finishOrRewind(playerId, position, depth + 1, ctx);
  }

  function drawCard(playerId: number, ctx: Context): void {
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
    playerId: number,
    delta: number,
    depth: number,
    ctx: Context,
  ): void {
    if (ctx.choice.current() != null) return;
    const position = ctx.movement.move(program.trackId, playerId, delta);
    applyTile(playerId, position, depth, ctx);
  }

  function moveToType(
    playerId: number,
    type: PairedPawnTileType,
    direction: 1 | -1,
    ctx: Context,
  ): void {
    let index = ctx.movement.position(program.trackId, playerId) + direction;
    while (index >= 0 && index < program.tiles.length) {
      if (program.tiles[index]?.type === type) {
        setPosition(playerId, index, ctx);
        applyTile(playerId, index, 0, ctx);
        return;
      }
      index += direction;
    }
  }

  function finishOrRewind(
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
    setPosition(playerId, position - rewind, ctx);
    applyTile(playerId, position - rewind, depth, ctx);
  }

  function setPosition(playerId: number, position: number, ctx: Context): void {
    const current = ctx.movement.position(program.trackId, playerId);
    ctx.movement.move(program.trackId, playerId, position - current);
  }

  function gain(playerId: number, amount: number, ctx: Context): void {
    ctx.resources.add(playerId, program.tokenResource, amount);
  }

  function pairedPawnEffects() {
    return {
      'pairedPawn.move': defineEffect<State, { delta: number }>({
        input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
        apply: ({ targetPlayerIds, data, ctx }) => {
          for (const playerId of targetPlayerIds)
            moveAndApply(playerId, data.delta, 0, ctx);
        },
      }),
      'pairedPawn.move-to-type': defineEffect<
        State,
        { type: string; direction: 'forward' | 'backward' }
      >({
        input: gameInput.object({
          type: gameInput.enum(Object.keys(program.tileRules)),
          direction: gameInput.enum(['forward', 'backward']),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            moveToType(
              actorPlayerId,
              data.type,
              data.direction === 'forward' ? 1 : -1,
              ctx,
            );
        },
      }),
      'pairedPawn.transfer-token': defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (
            actorPlayerId != null &&
            targetId != null &&
            ctx.resources.has(
              actorPlayerId,
              program.tokenResource,
              program.transferAmount,
            )
          )
            ctx.resources.transfer(
              actorPlayerId,
              targetId,
              program.tokenResource,
              program.transferAmount,
            );
        },
      ),
      'pairedPawn.share-advance': defineEmptyEffect<State>(
        ({ targetPlayerIds, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (targetId != null)
            moveAndApply(targetId, program.sharedAdvance, 0, ctx);
        },
      ),
      'pairedPawn.meeting': defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          if (actorPlayerId != null)
            moveAndApply(actorPlayerId, program.meetingAdvance, 0, ctx);
          const targetId = targetPlayerIds[0];
          if (targetId != null && ctx.match.lifecycle() !== 'finished')
            moveAndApply(targetId, program.meetingAdvance, 0, ctx);
        },
      ),
      'pairedPawn.roll-move': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) =>
          moveAndApply(
            actorPlayerId,
            ctx.dice.roll(program.diceId).total,
            0,
            ctx,
          ),
      ),
      'pairedPawn.roll-threshold-move': defineEmptyEffect<State>(
        ({ actorPlayerId, ctx }) => {
          if (
            actorPlayerId != null &&
            ctx.dice.roll(program.diceId).total >= program.rollMinimum
          )
            moveAndApply(actorPlayerId, program.rollAdvance, 0, ctx);
        },
      ),
    };
  }
}
