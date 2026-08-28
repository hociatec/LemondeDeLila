import { defineEffect, gameInput } from '../../../core/application/public-api';
import {
  COLLECTION_KINDS,
  TRACK,
  applyVoyageTarget,
  loseRandomCard,
  position,
  scheduleTargetEffect,
  type VoyageTargetEffect,
} from './rules';
import type { VoyageCollectionKind, VoyageState } from './state';

const TARGET_EFFECTS = ['swap-position', 'skip-turn', 'swap-card'] as const;

export const VOYAGE_EFFECTS = {
  'voyage.move': defineEffect<VoyageState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId == null) return;
      ctx.movement.move(TRACK, actorPlayerId, data.delta);
    },
  }),
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
        .sort((left, right) => position(left, ctx) - position(right, ctx))[0];
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
