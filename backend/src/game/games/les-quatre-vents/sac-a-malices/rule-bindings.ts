import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { defineChoice, gameInput } from '../../../engine/sdk/public-api';
import { resolveManagement, resolvePurchase } from './rules';
import type { SacBuilding, SacState } from './state';
export type SacPlayerView = {
  buildings: Record<number, SacBuilding>;
};
export const GAME_RULES = {
  choices: {
    'sac.purchase': defineChoice<SacState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, value, ctx }) => resolvePurchase(state, value, ctx),
    }),
    'sac.management': defineChoice<SacState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, value, ctx }) => resolveManagement(state, value, ctx),
    }),
  },
  viewExtension: ({ state }): SacPlayerView => ({
    buildings: Object.fromEntries(
      Object.entries(state.buildings).map(([position, building]) => [
        position,
        {
          houses: building.houses,
          hotel: building.hotel,
          mortgaged: building.mortgaged,
        },
      ]),
    ),
  }),
} satisfies GameRuleBindings<SacState, SacPlayerView>;
