import type { AFondLesBallonsState } from './state';
import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { A_FOND_LES_BALLONS_ACTIONS } from './rules';
export const GAME_BOT: GameBotDefinition<
  AFondLesBallonsState,
  typeof A_FOND_LES_BALLONS_ACTIONS
> = {
  choose: ({ availableActions }) =>
    availableActions.includes('draw_card')
      ? { type: 'draw_card', payload: {} }
      : { type: 'roll', payload: {} },
};
