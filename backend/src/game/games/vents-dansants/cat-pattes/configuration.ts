import {
  defineConfiguration,
  gameInput,
  type NoGameState,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import { CAT_PATTES_DEFAULT_ROUNDS } from './content';
export const CAT_PATTES_PHASES = setupPlayingPhases<NoGameState>();
export const GAME_CONFIGURATION = defineConfiguration<
  NoGameState,
  { roundsToPlay: number }
>({
  input: gameInput.object({
    roundsToPlay: gameInput.number({ integer: true, min: 1, max: 20 }),
  }),
  defaults: { roundsToPlay: CAT_PATTES_DEFAULT_ROUNDS },
  phase: CAT_PATTES_PHASES.initialPhase,
  permission: 'owner',
  ui: {
    title: 'Nombre de manches',
    submitLabel: 'Démarrer la course',
  },
  onConfigured: ({ ctx }) => {
    CAT_PATTES_PHASES.transition(ctx, 'playing');
    const firstPlayerId = ctx.players.all()[0]?.id;
    if (firstPlayerId != null) {
      ctx.round.start(firstPlayerId);
      ctx.turn.to(firstPlayerId);
    }
  },
});
