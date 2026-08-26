import {
  defineEffect,
  gameInput,
} from '../../../core/application/public-api';
import {
  applyPanierTarget,
  discardRandom,
  drawCourse,
  moveAndResolve,
  moveToNearestStand,
  type PanierTargetEffect,
  PANIER_REVERSED,
  requestQuiz,
} from './rules';
import type { PanierState } from './state';

const countInput = gameInput.object({
  count: gameInput.number({ integer: true, min: 1 }),
  everyone: gameInput.boolean(),
});

export const PANIER_EFFECTS = {
  'panier.move': defineEffect<PanierState, { delta: number }>({
    input: gameInput.object({
      delta: gameInput.number({ integer: true }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveAndResolve(state, actorPlayerId, data.delta, 0, ctx);
      }
    },
  }),
  'panier.draw': defineEffect<
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
  'panier.discard': defineEffect<
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
        discardRandom(recipient, data.count, ctx);
      }
    },
  }),
  'panier.reverse': defineEffect<PanierState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId == null) return;
      ctx.status.add(actorPlayerId, PANIER_REVERSED, { scope: 'until-used' });
      ctx.turn.reverse();
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
  'panier.target': defineEffect<PanierState, { kind: PanierTargetEffect }>({
    input: gameInput.object({
      kind: gameInput.enum([
        'swap-inventories',
        'strategic-swap',
        'discard',
        'steal',
        'random-swap',
      ] as const),
    }),
    apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        applyPanierTarget(actorPlayerId, targetId, data.kind, ctx);
      }
    },
  }),
} as const;
