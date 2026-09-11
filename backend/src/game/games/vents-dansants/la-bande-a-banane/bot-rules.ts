import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { BANDE_A_BANANE_ACTIONS, enumeratePlays } from './rules';
import type { BandeABananeState } from './types';
export const GAME_BOT: GameBotDefinition<
  BandeABananeState,
  typeof BANDE_A_BANANE_ACTIONS
> = {
  choose: ({ state, actor, ctx }) => {
    const play = enumeratePlays(state, actor.id, ctx)[0];
    return play
      ? { type: 'play_card', payload: play }
      : { type: 'pass', payload: {} };
  },
};
