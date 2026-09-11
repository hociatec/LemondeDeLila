import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { type GerardPresidentNameCard } from './content';
import { GERARD_ACTIONS } from './rules';
import type { GerardState } from './state';
import { GERARD_PHASES, GERARD_SUBMISSIONS } from './game-constants';
export const GAME_BOT: GameBotDefinition<GerardState, typeof GERARD_ACTIONS> = {
  choose: ({ state: _state, actor, ctx }) => {
    if (GERARD_PHASES.is(ctx, 'waiting-theme'))
      return { type: 'set_theme', payload: {} };
    if (GERARD_PHASES.is(ctx, 'choosing-winner')) {
      const winnerId = Number(
        Object.entries(
          ctx.submissions.values<string[]>(GERARD_SUBMISSIONS),
        ).find(([, names]) => names.length > 0)?.[0],
      );
      return { type: 'choose_winner', payload: { winnerId } };
    }
    const name = ctx.cards.hand<GerardPresidentNameCard>('names', actor.id)[0]
      ?.id;
    return name
      ? { type: 'play_name', payload: { names: [name] } }
      : { type: 'pass', payload: {} };
  },
};
