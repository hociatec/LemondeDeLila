import type { RitesStealChoice } from './types';
import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { defineChoice, gameInput } from '../../../engine/sdk/public-api';
import {
  resolveRitesCardChoice,
  resolveRitesFamilyChoice,
  resolveRitesStealChoice,
  RITES_SILENCE,
} from './rules';
import type { EntreRitesState } from './types';
export const GAME_RULES = {
  lifecycle: {
    beforeTurn: ({ ctx, player }) => {
      if (player) ctx.status.remove(player.id, RITES_SILENCE);
    },
  },
  choices: {
    'rites.card': defineChoice<EntreRitesState, string>({
      input: gameInput.cardId(),
      resolve: ({ state, value, ctx }) =>
        resolveRitesCardChoice(state, value, ctx),
    }),
    'rites.family': defineChoice<EntreRitesState, string[]>({
      input: gameInput.array(gameInput.cardId(), { min: 1 }),
      resolve: ({ state, value, ctx }) =>
        resolveRitesFamilyChoice(state, value, ctx),
    }),
    'rites.steal': defineChoice<EntreRitesState, RitesStealChoice>({
      input: gameInput.object({
        targetPlayerId: gameInput.playerId(),
        cardId: gameInput.cardId(),
      }),
      resolve: ({ state, value, ctx }) =>
        resolveRitesStealChoice(state, value, ctx),
    }),
  },
} satisfies GameRuleBindings<EntreRitesState>;
