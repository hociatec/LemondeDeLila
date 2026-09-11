import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { SAC_ACTIONS } from './actions';
import type { SacState } from './state';
export const GAME_BOT: GameBotDefinition<SacState, typeof SAC_ACTIONS> = {
  choose: ({ availableActions }) => {
    if (availableActions.includes('use_jail_card'))
      return { type: 'use_jail_card', payload: {} };
    if (availableActions.includes('pay_fine'))
      return { type: 'pay_fine', payload: {} };
    return availableActions.includes('roll')
      ? { type: 'roll', payload: {} }
      : null;
  },
};
