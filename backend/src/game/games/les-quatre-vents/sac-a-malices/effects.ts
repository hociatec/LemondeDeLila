import { defineEffect, gameInput } from '../../../engine/sdk/public-api';
import type { SacMovement } from './content';
import type { SacState } from './state';
import { changeMoney, loseInfrastructure } from './economy';
import { applyCardMovement } from './rules';

const movementInput = gameInput.union([
  gameInput.object({
    kind: gameInput.literal('delta'),
    delta: gameInput.number({ integer: true }),
  }),
  gameInput.object({
    kind: gameInput.enum([
      'last',
      'next-station',
      'next-community',
      'previous-chance',
    ] as const),
  }),
  gameInput.object({
    kind: gameInput.literal('start'),
    collect: gameInput.boolean(),
  }),
  gameInput.object({
    kind: gameInput.literal('next-group'),
    group: gameInput.string({ min: 1, max: 128 }),
  }),
  gameInput.object({
    kind: gameInput.literal('named'),
    name: gameInput.string({ min: 1, max: 256 }),
    direction: gameInput.enum(['forward', 'backward'] as const),
  }),
]);

export const SAC_EFFECTS = {
  'sac.lose-infrastructure': defineEffect<SacState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, ctx }) => {
      if (actorPlayerId != null) {
        loseInfrastructure(state, actorPlayerId, ctx);
      }
    },
  }),
  'sac.everyone-money': defineEffect<SacState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, data, ctx }) => {
      for (const player of ctx.players.active()) {
        changeMoney(state, player.id, data.delta, data.delta < 0, ctx);
      }
    },
  }),
  'sac.movement': defineEffect<SacState, { movement: SacMovement }>({
    input: gameInput.object({ movement: movementInput }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        applyCardMovement(state, actorPlayerId, data.movement, ctx);
      }
    },
  }),
  'sac.money': defineEffect<SacState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        changeMoney(state, actorPlayerId, data.delta, data.delta < 0, ctx);
      }
    },
  }),
} as const;
