import { defineEffect, gameInput } from '../../../engine/sdk/public-api';
import {
  drawCourse,
  moveAndResolve,
  moveToNearestStand,
  requestQuiz,
  requestStrategicSwap,
} from './rules';
import type { PanierState } from './types';

const countInput = gameInput.object({
  count: gameInput.number({ integer: true, min: 1 }),
  everyone: gameInput.boolean(),
});

export const PANIER_EFFECTS = {
  'panier.move-and-resolve': defineEffect<PanierState, { delta: number }>({
    input: gameInput.object({
      delta: gameInput.number({ integer: true }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveAndResolve(state, actorPlayerId, data.delta, 0, ctx);
      }
    },
  }),
  'panier.draw-course': defineEffect<
    PanierState,
    { count: number; everyone: boolean }
  >({
    input: countInput,
    apply: ({ actorPlayerId, data, ctx }) => {
      const recipients = data.everyone
        ? ctx.players.all().map((player) => player.id)
        : actorPlayerId == null
          ? []
          : [actorPlayerId];
      for (const recipient of recipients) {
        for (let count = 0; count < data.count; count += 1) {
          drawCourse(recipient, 'bonus', ctx);
        }
      }
    },
  }),
  'panier.quiz': defineEffect<PanierState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) requestQuiz(actorPlayerId, ctx);
    },
  }),
  'panier.nearest-stand': defineEffect<PanierState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, ctx }) => {
      if (actorPlayerId != null) {
        moveToNearestStand(state, actorPlayerId, 0, ctx);
      }
    },
  }),
  'panier.strategic-swap': defineEffect<PanierState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        requestStrategicSwap(actorPlayerId, targetId, ctx);
      }
    },
  }),
} as const;
