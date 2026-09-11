import type {
  GameBotDefinition,
  NoGameState as LesMainsState,
} from '../../../engine/sdk/public-api';
import { LES_MAINS_ACTIONS } from './rules';
export const GAME_BOT: GameBotDefinition<
  LesMainsState,
  typeof LES_MAINS_ACTIONS
> = {
  choose: ({ state, actor, ctx }) => {
    const first = LES_MAINS_ACTIONS.request_card.enumerate?.({
      state,
      actor,
      ctx,
    })[0];
    return first ? { type: 'request_card', payload: first } : null;
  },
};
