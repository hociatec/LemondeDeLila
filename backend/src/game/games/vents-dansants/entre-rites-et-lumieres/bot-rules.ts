import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { ENTRE_RITES_ACTIONS, enumerateRequests, RITES_PEACE } from './rules';
import type { EntreRitesState } from './types';
export const GAME_BOT: GameBotDefinition<
  EntreRitesState,
  typeof ENTRE_RITES_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    const request = ctx.players
      .all()
      .every(
        (player) =>
          (ctx.status.get(player.id, RITES_PEACE)?.remaining ?? 0) === 0,
      )
      ? enumerateRequests(actor.id, ctx)[0]
      : null;
    return request
      ? { type: 'ask_card', payload: request }
      : { type: 'pass', payload: {} };
  },
};
