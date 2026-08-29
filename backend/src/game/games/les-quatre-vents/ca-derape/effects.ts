import { defineEffect, gameInput } from '../../../engine/sdk/public-api';
import {
  CA_CONDITIONAL_EFFECTS,
  CA_GLOBAL_EFFECTS,
  CA_RULE_EFFECTS,
  CA_SPECIAL_EFFECTS,
  type CaConditionalEffect,
  type CaGlobalEffect,
  type CaRuleEffect,
  type CaSpecialEffect,
} from './content';
import {
  CA_MIRROR_ROLL,
  TRACK,
  applyConditional,
  applyGlobal,
  applyPenaltyAwareMove,
  applyRule,
  applySpecial,
  consumePenaltyShield,
  markWinnerIfReached,
} from './rules';
import type { NoGameState as CaDerapeState } from '../../../engine/sdk/public-api';

export const CA_DERAPE_EFFECTS = {
  'ca-derape.move': defineEffect<CaDerapeState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        applyPenaltyAwareMove(state, actorPlayerId, data.delta, 0, ctx);
      }
    },
  }),
  'ca-derape.skip-penalty': defineEffect<CaDerapeState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null && !consumePenaltyShield(actorPlayerId, ctx)) {
        ctx.turn.skip(actorPlayerId, 1);
      }
    },
  }),
  'ca-derape.special': defineEffect<
    CaDerapeState,
    { effect: CaSpecialEffect; delta: number }
  >({
    input: gameInput.object({
      effect: gameInput.enum(CA_SPECIAL_EFFECTS),
      delta: gameInput.number({ integer: true }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        applySpecial(state, actorPlayerId, data.effect, data.delta, ctx);
      }
    },
  }),
  'ca-derape.global': defineEffect<CaDerapeState, { effect: CaGlobalEffect }>({
    input: gameInput.object({ effect: gameInput.enum(CA_GLOBAL_EFFECTS) }),
    apply: ({ data, ctx }) => applyGlobal(data.effect, ctx),
  }),
  'ca-derape.conditional': defineEffect<
    CaDerapeState,
    { effect: CaConditionalEffect }
  >({
    input: gameInput.object({
      effect: gameInput.enum(CA_CONDITIONAL_EFFECTS),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        applyConditional(state, actorPlayerId, data.effect, ctx);
      }
    },
  }),
  'ca-derape.rule': defineEffect<CaDerapeState, { effect: CaRuleEffect }>({
    input: gameInput.object({ effect: gameInput.enum(CA_RULE_EFFECTS) }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        applyRule(state, actorPlayerId, data.effect, ctx);
      }
    },
  }),
  'ca-derape.mark-winner': defineEffect<CaDerapeState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ ctx }) => markWinnerIfReached(ctx),
  }),
  'ca-derape.swap': defineEffect<CaDerapeState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId == null || targetId == null) return;
      ctx.movement.swap(TRACK, actorPlayerId, targetId);
    },
  }),
  'ca-derape.next-player': defineEffect<CaDerapeState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (targetId != null) ctx.turn.to(targetId);
    },
  }),
  'ca-derape.mirror': defineEffect<CaDerapeState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId == null || targetId == null) return;
      ctx.status.add(actorPlayerId, CA_MIRROR_ROLL, {
        scope: 'until-used',
        data: { sourcePlayerId: targetId },
      });
    },
  }),
} as const;
