import {
  defineConfiguration,
  gameInput,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import { CORRIDOR_DEFAULT_WALLS } from './content';
import { CORRIDOR_PHASES, startCorridorSetup } from './rules';
export const GAME_CONFIGURATION = defineConfiguration<
  NoGameState,
  { wallsPerPlayer: number }
>({
  input: gameInput.object({
    wallsPerPlayer: gameInput.number({ integer: true, min: 0, max: 20 }),
  }),
  defaults: { wallsPerPlayer: CORRIDOR_DEFAULT_WALLS },
  phase: CORRIDOR_PHASES.initialPhase,
  permission: 'owner',
  ui: {
    title: 'Configuration du Corridor',
    submitLabel: 'Choisir les pions',
  },
  onConfigured: ({ config, ctx }) =>
    startCorridorSetup(config.wallsPerPlayer, ctx),
});
