import {
  defineEffect,
  gameInput,
  positionOf,
} from '../../../engine/sdk/public-api';
import {
  COLLECTION_KINDS,
  TRACK,
  applyVoyageTarget,
  loseRandomCard,
  scheduleTargetEffect,
  type VoyageTargetEffect,
} from './rules';
import type { VoyageCollectionKind, VoyageState } from './types';

const TARGET_EFFECTS = ['swap-position', 'skip-turn', 'swap-card'] as const;

export const VOYAGE_EFFECTS = {
  'voyage.schedule-target': defineEffect<
    VoyageState,
    { effect: VoyageTargetEffect; count: number }
  >({
    input: gameInput.object({
      effect: gameInput.enum(TARGET_EFFECTS),
      count: gameInput.number({ integer: true, min: 1 }),
    }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        scheduleTargetEffect(actorPlayerId, data.effect, data.count, ctx);
      }
    },
  }),
  'voyage.lose-random-card': defineEffect<
    VoyageState,
    { allowed: VoyageCollectionKind[] }
  >({
    input: gameInput.object({
      allowed: gameInput.array(gameInput.enum(COLLECTION_KINDS), { min: 1 }),
    }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        loseRandomCard(actorPlayerId, data.allowed, ctx);
      }
    },
  }),
  'voyage.swap-last-player': defineEffect<VoyageState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId == null) return;
      const targetId = ctx.players
        .otherIds(actorPlayerId)
        .sort(
          (left, right) =>
            positionOf(ctx, TRACK, left) - positionOf(ctx, TRACK, right),
        )[0];
      if (targetId != null) ctx.movement.swap(TRACK, actorPlayerId, targetId);
    },
  }),
  'voyage.target': defineEffect<
    VoyageState,
    { effect: VoyageTargetEffect; count: number }
  >({
    input: gameInput.object({
      effect: gameInput.enum(TARGET_EFFECTS),
      count: gameInput.number({ integer: true, min: 1 }),
    }),
    apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        applyVoyageTarget(
          actorPlayerId,
          targetId,
          data.effect,
          data.count,
          ctx,
        );
      }
    },
  }),
} as const;
