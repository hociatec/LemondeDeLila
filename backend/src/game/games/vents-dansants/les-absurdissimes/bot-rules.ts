import type {
  NoGameState as AbsurdissimesState,
  GameBotDefinition,
} from '../../../engine/sdk/public-api';
import type { AbsurdissimesCard } from './content';
import {
  ABSURDISSIMES_ACTIONS,
  ABSURDISSIMES_ANSWERS,
  ABSURDISSIMES_PHASES,
} from './rules';
export const GAME_BOT: GameBotDefinition<
  AbsurdissimesState,
  typeof ABSURDISSIMES_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    if (ABSURDISSIMES_PHASES.is(ctx, 'judge')) {
      const winnerId = ctx.random.pick(
        Object.keys(ctx.submissions.values(ABSURDISSIMES_ANSWERS)).map(Number),
      );
      return winnerId == null
        ? null
        : { type: 'judge_pick', payload: { winnerId } };
    }
    const cardId = ctx.random.pick(
      ctx.cards.hand<AbsurdissimesCard>('answers', actor.id),
    )?.id;
    return cardId == null ? null : { type: 'play_card', payload: { cardId } };
  },
};
