import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import { CAT_PATTES_ACTIONS, playableInputs } from './rules';
export const GAME_BOT: GameBotDefinition<
  NoGameState,
  typeof CAT_PATTES_ACTIONS
> = {
  choose: ({ state, actor, ctx }) => {
    if (ctx.effects.sourcePlayerId() !== actor.id) {
      return { type: 'draw', payload: {} };
    }
    const input = playableInputs(state, actor.id, ctx)[0];
    if (input) return { type: 'play_card', payload: { ...input } };
    const cardId = ctx.cards.hand<string>('players', actor.id)[0];
    return {
      type: 'discard_card',
      payload: cardId ? { cardId } : {},
    };
  },
};
