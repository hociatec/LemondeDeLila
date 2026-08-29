import {
  defineConfiguration,
  gameInput,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import type { LamaConfig } from './config';
import { LAMA_PHASES, startLama } from './rules';

const LAMA_DEFAULT_CONFIG: LamaConfig = {
  loseAtScore: 40,
  roundPauseSeconds: 0,
  allowPlayAfterDraw: false,
  startingHandSize: 6,
  copiesPerCardValue: 8,
  returnTokenFromRound: 2,
};

export const LAMA_CONFIGURATION = defineConfiguration<NoGameState, LamaConfig>({
  input: gameInput.object({
    loseAtScore: gameInput.number({ integer: true, min: 5, max: 200 }),
    roundPauseSeconds: gameInput.number({ integer: true, min: 0, max: 120 }),
    allowPlayAfterDraw: gameInput.boolean(),
    startingHandSize: gameInput.number({ integer: true, min: 1, max: 20 }),
    copiesPerCardValue: gameInput.number({ integer: true, min: 1, max: 20 }),
    returnTokenFromRound: gameInput.number({ integer: true, min: 1, max: 50 }),
  }),
  defaults: LAMA_DEFAULT_CONFIG,
  phase: LAMA_PHASES.initialPhase,
  permission: 'owner',
  ui: {
    title: 'Configuration LAMA',
    submitLabel: 'Démarrer la partie',
  },
  validate: ({ config, ctx }) =>
    ctx.players.count() * config.startingHandSize + 1 <=
    config.copiesPerCardValue * 7,
  onConfigured: ({ state, ctx }) => startLama(state, ctx),
});
