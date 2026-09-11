import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { PIMP_MY_RIDE_ACTIONS } from './rules';
import type { PimpMyRideState } from './state';
export const GAME_BOT: GameBotDefinition<
  PimpMyRideState,
  typeof PIMP_MY_RIDE_ACTIONS
> = {
  choose: ({ state, actor, ctx }) => {
    const play = PIMP_MY_RIDE_ACTIONS.play_card.enumerate?.({
      state,
      actor,
      ctx,
    })[0];
    return play
      ? { type: 'play_card', payload: play }
      : { type: 'pass', payload: {} };
  },
};
