import {
  defineEffect,
  gameInput,
} from '../../../core/application/public-api';
import {
  applyTarget,
  drawAndApply,
  drawBonusGift,
  drainResolution,
  extendTurnStatus,
  moveAndLand,
  position,
  previousMalus,
  queueDraws,
  requestAbundance,
  requestLaughter,
  requestOption,
  rollDie,
  scheduleContesTarget,
  swapClosestBehind,
} from './resolution';
import { CONTES_STATUSES } from './constants';
import type { ContesCardType } from './content';
import type {
  ContesState,
  ContesTargetEffect,
} from './state';

export const CONTES_EFFECTS = {
  'contes.move': defineEffect<ContesState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        moveAndLand(state, playerId, data.delta, 0, ctx);
      }
    },
  }),
  'contes.roll-move': defineEffect<
    ContesState,
    { mode: 'double' | 'half' | 'backward' }
  >({
    input: gameInput.object({
      mode: gameInput.enum(['double', 'half', 'backward'] as const),
    }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        const roll = rollDie(ctx);
        const delta =
          data.mode === 'double'
            ? roll * 2
            : data.mode === 'half'
              ? Math.floor(roll / 2)
              : -roll;
        moveAndLand(state, playerId, delta, 0, ctx);
      }
    },
  }),
  'contes.draw': defineEffect<ContesState, { type: ContesCardType }>({
    input: gameInput.object({
      type: gameInput.enum(['bonus', 'malus', 'surprise', 'conte'] as const),
    }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        drawAndApply(state, playerId, data.type, 0, ctx);
      }
    },
  }),
  'contes.schedule-target': defineEffect<
    ContesState,
    { effect: ContesTargetEffect }
  >({
    input: gameInput.object({
      effect: gameInput.enum([
        'move-other-two',
        'swap-next-turns',
        'swap-positions',
        'steal-token',
        'travelling-book',
      ] as const),
    }),
    apply: ({ targetPlayerIds, data, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) scheduleContesTarget(playerId, data.effect, ctx);
    },
  }),
  'contes.queue-draws': defineEffect<
    ContesState,
    { types: ContesCardType[] }
  >({
    input: gameInput.object({
      types: gameInput.array(
        gameInput.enum(['bonus', 'malus', 'surprise', 'conte'] as const),
        { min: 1 },
      ),
    }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) queueDraws(state, playerId, data.types, ctx);
    },
  }),
  'contes.queue-random-draws': defineEffect<
    ContesState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId == null) return;
      const types: ContesCardType[] = ['bonus', 'malus', 'surprise'];
      queueDraws(state, playerId, ctx.random.shuffle(types).slice(0, 2), ctx);
    },
  }),
  'contes.extend-status': defineEffect<
    ContesState,
    { status: 'contes.forced-one' | 'contes.no-bonus'; turns: number }
  >({
    input: gameInput.object({
      status: gameInput.enum([
        CONTES_STATUSES.forcedOne,
        CONTES_STATUSES.noBonus,
      ] as const),
      turns: gameInput.number({ integer: true, min: 1 }),
    }),
    apply: ({ targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        extendTurnStatus(playerId, data.status, data.turns, ctx);
      }
    },
  }),
  'contes.force-one-others': defineEffect<
    ContesState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId == null) return;
      for (const other of ctx.players.all()) {
        if (other.id !== playerId) {
          extendTurnStatus(other.id, CONTES_STATUSES.forcedOne, 1, ctx);
        }
      }
    },
  }),
  'contes.swap-closest': defineEffect<
    ContesState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) swapClosestBehind(playerId, ctx);
    },
  }),
  'contes.block': defineEffect<ContesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId == null) return;
      ctx.status.add(playerId, CONTES_STATUSES.blocked, {
        scope: 'until-used',
        data: { position: position(playerId, ctx) },
      });
    },
  }),
  'contes.bonus-gift': defineEffect<ContesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) drawBonusGift(state, playerId, ctx);
    },
  }),
  'contes.skip-if-low-roll': defineEffect<
    ContesState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null && rollDie(ctx) < 4) ctx.turn.skip(playerId, 1);
    },
  }),
  'contes.previous-malus': defineEffect<
    ContesState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) previousMalus(state, playerId, 0, ctx);
    },
  }),
  'contes.abundance': defineEffect<ContesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) requestAbundance(state, playerId, ctx);
    },
  }),
  'contes.laughter': defineEffect<ContesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) requestLaughter(state, playerId, ctx);
    },
  }),
  'contes.option': defineEffect<
    ContesState,
    { effect: 'song' | 'wish' }
  >({
    input: gameInput.object({
      effect: gameInput.enum(['song', 'wish'] as const),
    }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) requestOption(state, playerId, data.effect, ctx);
    },
  }),
  'contes.conte': defineEffect<ContesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (
        playerId != null &&
        ctx.status.has(playerId, CONTES_STATUSES.keyOfGold)
      ) {
        scheduleContesTarget(playerId, 'gold-key', ctx);
      }
    },
  }),
  'contes.target': defineEffect<
    ContesState,
    { actorId: number; effect: ContesTargetEffect; cardId?: number }
  >({
    input: gameInput.object({
      actorId: gameInput.number({ integer: true, min: 1 }),
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
      ] as const),
      cardId: gameInput.optional(
        gameInput.number({ integer: true, min: 1 }),
      ),
    }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (targetId == null) return;
      applyTarget(
        state,
        data.actorId,
        targetId,
        data.effect,
        data.cardId,
        ctx,
      );
      drainResolution(state, ctx);
    },
  }),
} as const;
