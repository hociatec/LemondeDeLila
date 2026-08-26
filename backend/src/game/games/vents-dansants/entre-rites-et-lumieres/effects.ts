import {
  defineEffect,
  gameInput,
} from '../../../core/application/public-api';
import {
  collectFromOthers,
  dawnCycle,
  drawForPlayer,
  drawTwoChoice,
  freeFamilyChoice,
  resurrectionChoice,
  stealChoice,
} from './rules';
import type { EntreRitesState } from './state';

export const ENTRE_RITES_EFFECTS = {
  'rites.draw-two': defineEffect<EntreRitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) drawTwoChoice(state, playerId, ctx);
    },
  }),
  'rites.draw-one': defineEffect<EntreRitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) drawForPlayer(state, playerId, ctx);
    },
  }),
  'rites.collect': defineEffect<EntreRitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) collectFromOthers(state, playerId, ctx);
    },
  }),
  'rites.resurrect': defineEffect<EntreRitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) resurrectionChoice(state, playerId, ctx);
    },
  }),
  'rites.free-family': defineEffect<EntreRitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) freeFamilyChoice(state, playerId, ctx);
    },
  }),
  'rites.dawn-cycle': defineEffect<EntreRitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ state, ctx }) => dawnCycle(state, ctx),
  }),
  'rites.steal-choice': defineEffect<
    EntreRitesState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) stealChoice(state, playerId, ctx);
    },
  }),
} as const;
