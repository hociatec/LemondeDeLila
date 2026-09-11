import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import { MNEMO_ACTIONS } from './rules';
export const GAME_BOT: GameBotDefinition<NoGameState, typeof MNEMO_ACTIONS> = {
  choose: ({ availableActions, ctx }) => {
    if (availableActions.includes('answer'))
      return { type: 'answer', payload: { answerIndex: ctx.random.int(4) } };
    if (availableActions.includes('draw')) return { type: 'draw', payload: {} };
    if (availableActions.includes('timeout'))
      return { type: 'timeout', payload: {} };
    return null;
  },
};
