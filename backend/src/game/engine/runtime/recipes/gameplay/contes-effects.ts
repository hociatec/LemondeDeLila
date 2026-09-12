import { gameInput } from '../../actions/game-input-schema';
import type {
  ContesCardType,
  ContesProgram,
  ContesTargetEffect,
} from '../../extensions/contes/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import type { createContesResolution } from './contes-resolution';

type State = Record<string, never>;
type Context = GameContext<State>;
type Resolution = ReturnType<typeof createContesResolution>;

export function createContesEffects(
  program: ContesProgram,
  resolution: Resolution,
) {
  const { statuses } = program;
  const movementEffects = () => ({
    'contes.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ state, targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          resolution.moveAndResolve(state, playerId, data.delta, 0, ctx);
      },
    }),
    'contes.roll-move': defineEffect<
      State,
      { mode: 'double' | 'half' | 'backward' }
    >({
      input: gameInput.object({
        mode: gameInput.enum(['double', 'half', 'backward']),
      }),
      apply: ({ state, targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds) {
          const roll = ctx.dice.roll('main').total;
          const delta =
            data.mode === 'double'
              ? roll * 2
              : data.mode === 'half'
                ? Math.floor(roll / 2)
                : -roll;
          resolution.moveAndResolve(state, playerId, delta, 0, ctx);
        }
      },
    }),
    'contes.draw': defineEffect<State, { type: ContesCardType }>({
      input: gameInput.object({
        type: gameInput.enum(['bonus', 'malus', 'surprise', 'conte']),
      }),
      apply: ({ state, targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          resolution.drawCard(state, playerId, data.type, 0, ctx);
      },
    }),
    'contes.schedule-target': defineEffect<
      State,
      { effect: ContesTargetEffect }
    >({
      input: gameInput.object({
        effect: gameInput.enum([
          'move-other-two',
          'swap-next-turns',
          'swap-positions',
          'steal-token',
          'travelling-book',
        ]),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        const playerId = targetPlayerIds[0];
        if (playerId != null)
          resolution.scheduleTarget(playerId, data.effect, ctx);
      },
    }),
    'contes.queue-draws': defineEffect<State, { types: ContesCardType[] }>({
      input: gameInput.object({
        types: gameInput.array(
          gameInput.enum(['bonus', 'malus', 'surprise', 'conte']),
          { min: 1 },
        ),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        const playerId = targetPlayerIds[0];
        if (playerId != null) resolution.queueDraws(playerId, data.types, ctx);
      },
    }),
    'contes.queue-random-draws': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ targetPlayerIds, ctx }) => {
        const playerId = targetPlayerIds[0];
        if (playerId == null) return;
        const types: ContesCardType[] = ['bonus', 'malus', 'surprise'];
        resolution.queueDraws(
          playerId,
          ctx.random.shuffle(types).slice(0, 2),
          ctx,
        );
      },
    }),
    'contes.extend-status': defineEffect<
      State,
      { status: string; turns: number }
    >({
      input: gameInput.object({
        status: gameInput.enum([statuses.forcedOne, statuses.noBonus]),
        turns: gameInput.number({ integer: true, min: 1 }),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          resolution.extendTurnStatus(playerId, data.status, data.turns, ctx);
      },
    }),
  });
  const storyEffects = () => ({
    'contes.force-one-others': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ targetPlayerIds, ctx }) => {
        const playerId = targetPlayerIds[0];
        if (playerId == null) return;
        for (const other of ctx.players.all())
          if (other.id !== playerId)
            resolution.extendTurnStatus(other.id, statuses.forcedOne, 1, ctx);
      },
    }),
    'contes.swap-closest': emptyEffect(({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) resolution.swapClosestBehind(playerId, ctx);
    }),
    'contes.block': emptyEffect(({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId == null) return;
      ctx.status.add(playerId, statuses.blocked, {
        scope: 'until-used',
        data: { position: ctx.movement.position(program.trackId, playerId) },
      });
    }),
    'contes.bonus-gift': emptyEffect(({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) resolution.drawBonusGift(state, playerId, ctx);
    }),
    'contes.skip-if-low-roll': emptyEffect(({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null && ctx.dice.roll('main').total < 4)
        ctx.turn.skip(playerId, 1);
    }),
    'contes.previous-malus': emptyEffect(({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) resolution.previousMalus(state, playerId, 0, ctx);
    }),
    'contes.abundance': emptyEffect(({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) resolution.requestAbundance(playerId, ctx);
    }),
    'contes.laughter': emptyEffect(({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) resolution.requestLaughter(playerId, ctx);
    }),
    'contes.option': defineEffect<State, { effect: 'song' | 'wish' }>({
      input: gameInput.object({
        effect: gameInput.enum(['song', 'wish']),
      }),
      apply: ({ targetPlayerIds, data, ctx }) => {
        const playerId = targetPlayerIds[0];
        if (playerId != null)
          resolution.requestOption(playerId, data.effect, ctx);
      },
    }),
    'contes.conte': emptyEffect(({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null && ctx.status.has(playerId, statuses.keyOfGold))
        resolution.scheduleTarget(playerId, 'gold-key', ctx);
    }),
    'contes.target': defineEffect<
      State,
      {
        actorId: number;
        effect: ContesTargetEffect;
        cardId?: number;
      }
    >({
      input: gameInput.object({
        actorId: gameInput.playerId(),
        effect: gameInput.enum([
          'move-other-two',
          'swap-next-turns',
          'give-bonus',
          'swap-positions',
          'steal-token',
          'travelling-book',
          'song-steal',
          'wish-swap',
          'gold-key',
        ]),
        cardId: gameInput.optional(gameInput.number({ integer: true, min: 1 })),
      }),
      apply: ({ state, targetPlayerIds, data, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (targetId == null) return;
        resolution.applyTarget(
          state,
          data.actorId,
          targetId,
          data.effect,
          data.cardId,
          ctx,
        );
        resolution.drainResolution(state, ctx);
      },
    }),
  });
  return { ...movementEffects(), ...storyEffects() };
}
function emptyEffect(
  apply: (input: {
    state: State;
    targetPlayerIds: readonly number[];
    ctx: Context;
  }) => void,
) {
  return defineEffect<State, Record<string, never>>({
    input: gameInput.object({}),
    apply,
  });
}
