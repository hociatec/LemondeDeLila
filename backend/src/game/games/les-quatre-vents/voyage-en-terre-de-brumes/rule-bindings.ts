import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { defineChoice, gameInput } from '../../../engine/sdk/public-api';
import { advanceFinishCountdown, resolveVoyageQuiz } from './rules';
import type { VoyageState } from './types';
export const GAME_RULES = {
  lifecycle: {
    afterTurn: ({ state, ctx }) => advanceFinishCountdown(state, ctx),
  },
  choices: {
    'voyage.choice': defineChoice<VoyageState, string>({
      input: gameInput.string({ min: 1, max: 256 }),
      resolve: ({ state, value, ctx }) => resolveVoyageQuiz(state, value, ctx),
    }),
  },
} satisfies GameRuleBindings<VoyageState>;
