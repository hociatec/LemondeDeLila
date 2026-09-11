import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { CERCLES_SACRES_ACTIONS } from './rules';
import type { CerclesSacresState } from './types';
export const GAME_BOT: GameBotDefinition<
  CerclesSacresState,
  typeof CERCLES_SACRES_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    const available = CERCLES_SACRES_ACTIONS.form_circle.enumerate?.({
      state: ctx.state,
      actor,
      ctx,
    });
    if (available?.[0]) {
      return { type: 'form_circle', payload: available[0] };
    }
    const hand = ctx.cards.hand<string>('players', actor.id);
    return hand.length > 8
      ? { type: 'discard_card', payload: { cardId: hand[0] } }
      : { type: 'pass', payload: {} };
  },
};
