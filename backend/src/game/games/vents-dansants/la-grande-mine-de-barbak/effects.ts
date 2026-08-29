import { defineEffect, gameInput } from '../../../engine/sdk/public-api';
import type { GrandeMineState } from './types';
import {
  discardRandomHand,
  drawPassive,
  finishMine,
  recoverDiscard,
  removeRandomDomainCard,
  removeRandomTreasure,
  trimHand,
} from './rules';

export const GRANDE_MINE_EFFECTS = {
  'mine.log-card': defineEffect<GrandeMineState, { cardId: string }>({
    input: gameInput.object({ cardId: gameInput.cardId() }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        ctx.events.message('grande-mine.card.triggered', {
          playerId: actorPlayerId,
          cardId: data.cardId,
        });
      }
    },
  }),
  'mine.remove-domain': defineEffect<GrandeMineState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (targetId != null) removeRandomDomainCard(targetId, ctx);
    },
  }),
  'mine.remove-domain-all': defineEffect<
    GrandeMineState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ ctx }) => {
      for (const player of ctx.players.all()) {
        removeRandomDomainCard(player.id, ctx);
      }
    },
  }),
  'mine.remove-treasure-all': defineEffect<GrandeMineState, { count: number }>({
    input: gameInput.object({
      count: gameInput.number({ integer: true, min: 0 }),
    }),
    apply: ({ data, ctx }) => {
      for (const player of ctx.players.all()) {
        for (let count = 0; count < data.count; count += 1) {
          removeRandomTreasure(player.id, ctx);
        }
      }
    },
  }),
  'mine.recover-discard': defineEffect<GrandeMineState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) recoverDiscard(actorPlayerId, ctx);
    },
  }),
  'mine.draw-passive': defineEffect<GrandeMineState, { count: number }>({
    input: gameInput.object({
      count: gameInput.number({ integer: true, min: 0 }),
    }),
    apply: ({ targetPlayerIds, data, ctx }) => {
      for (const targetId of targetPlayerIds) {
        for (let count = 0; count < data.count; count += 1) {
          drawPassive(targetId, ctx);
        }
      }
    },
  }),
  'mine.trim-hand': defineEffect<GrandeMineState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) trimHand(actorPlayerId, ctx);
    },
  }),
  'mine.double-next-player': defineEffect<
    GrandeMineState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId == null) return;
      const nextId = ctx.players.after(actorPlayerId)?.id ?? null;
      if (nextId == null) return;
      ctx.turn.to(nextId);
      ctx.turn.extra();
      ctx.turn.to(actorPlayerId);
    },
  }),
  'mine.discard-target-hand': defineEffect<
    GrandeMineState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (targetId != null) discardRandomHand(targetId, ctx);
    },
  }),
  'mine.remove-treasure': defineEffect<GrandeMineState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) removeRandomTreasure(actorPlayerId, ctx);
    },
  }),
  'mine.finish': defineEffect<GrandeMineState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) {
        ctx.events.message('grande-mine.final-collapse.triggered', {
          playerId: actorPlayerId,
        });
      }
      finishMine(ctx);
    },
  }),
} as const;
