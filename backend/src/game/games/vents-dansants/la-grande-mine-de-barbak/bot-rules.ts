import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { enumeratePlays, GRANDE_MINE_ACTIONS } from './rules';
import type { GrandeMineState } from './types';
export const GAME_BOT: GameBotDefinition<
  GrandeMineState,
  typeof GRANDE_MINE_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    const play = enumeratePlays(actor.id, ctx)[0];
    return play
      ? { type: 'play_card', payload: play }
      : { type: 'pass', payload: {} };
  },
};
