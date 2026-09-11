import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import { DAME_NATURE_FAMILY_CARD_IDS } from './content';
import { DAME_NATURE_ACTIONS } from './rules';
export const GAME_BOT: GameBotDefinition<
  NoGameState,
  typeof DAME_NATURE_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    const target = ctx.players.all().find((player) => player.id !== actor.id);
    const cardId =
      DAME_NATURE_FAMILY_CARD_IDS[
        ctx.random.int(DAME_NATURE_FAMILY_CARD_IDS.length)
      ];
    return target
      ? { type: 'ask_card', payload: { targetPlayerId: target.id, cardId } }
      : { type: 'pass', payload: {} };
  },
};
