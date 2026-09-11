import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import { nextLamaValue, type LamaCard } from './content';
import { LAMA_ACTIONS } from './rules';
type LamaState = NoGameState;
export const GAME_BOT: GameBotDefinition<LamaState, typeof LAMA_ACTIONS> = {
  choose: ({ state: _state, actor, availableActions, ctx }) => {
    if (availableActions.includes('lama_play')) {
      const discard = ctx.cards.discardPile<LamaCard>('lama');
      const top = discard.at(-1);
      const playable = ctx.cards
        .hand<LamaCard>('lama-hands', actor.id)
        .find(
          (card) =>
            top != null && (card === top || card === nextLamaValue(top)),
        );
      if (playable != null)
        return { type: 'lama_play', payload: { value: playable } };
    }
    if (availableActions.includes('draw')) return { type: 'draw', payload: {} };
    if (
      ctx.turn.flags.get<boolean>('lama.drawn') &&
      availableActions.includes('lama_pass')
    )
      return { type: 'lama_pass', payload: {} };
    return availableActions.includes('lama_quit')
      ? { type: 'lama_quit', payload: {} }
      : null;
  },
};
