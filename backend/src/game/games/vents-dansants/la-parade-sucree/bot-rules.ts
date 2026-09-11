import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { PARADE_CARD_BY_ID, PARADE_SEQUENCE } from './content';
import { PARADE_ACTIONS, sequenceIndex } from './rules';
import type { LaParadeSucreeState } from './types';
export const GAME_BOT: GameBotDefinition<
  LaParadeSucreeState,
  typeof PARADE_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    const expected = PARADE_SEQUENCE[sequenceIndex(ctx)];
    const cardId = ctx.cards
      .hand<string>('players', actor.id)
      .find((candidate) => PARADE_CARD_BY_ID[candidate]?.value === expected);
    return cardId
      ? { type: 'play_card', payload: { cardId } }
      : { type: 'pass', payload: {} };
  },
};
