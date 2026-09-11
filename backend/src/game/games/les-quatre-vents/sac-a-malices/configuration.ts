import {
  defineConfiguration,
  defineEvent,
  gameInput,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import { SAC_VARIANTS, type SacVariantId } from './content';
import type { SacState } from './state';
export const SAC_VARIANT_IDS = SAC_VARIANTS.map((variant) => variant.id);
export const SAC_PHASES = setupPlayingPhases<SacState>();
export const VARIANT_SELECTED = defineEvent({
  type: 'game.variant.selected',
  data: gameInput.object({ variantId: gameInput.enum(SAC_VARIANT_IDS) }),
});
export const GAME_CONFIGURATION = defineConfiguration<
  SacState,
  { variantId: SacVariantId }
>({
  input: gameInput.object({
    variantId: gameInput.enum(SAC_VARIANT_IDS),
  }),
  defaults: { variantId: 'classic' },
  phase: SAC_PHASES.initialPhase,
  permission: 'owner',
  ui: {
    title: 'Variante du plateau',
    submitLabel: 'Démarrer la partie',
  },
  onConfigured: ({ state: _state, config, ctx }) => {
    const selected = SAC_VARIANTS.find(
      (variant) => variant.id === config.variantId,
    );
    if (!selected) return ctx.reject('UNKNOWN_VARIANT', config);
    for (const player of ctx.players.all()) {
      ctx.resources.set(player.id, 'money', selected.rules.startMoney);
    }
    SAC_PHASES.transition(ctx, 'playing');
    VARIANT_SELECTED.emit(ctx, {
      variantId: selected.id,
    });
  },
});
