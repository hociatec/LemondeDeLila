import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { NAWAK_ACTIONS, nawakStage } from './rules';
import type { NawakState } from './state';
export const GAME_BOT: GameBotDefinition<NawakState, typeof NAWAK_ACTIONS> = {
  choose: ({ state: _state, actor, ctx }) => {
    if (nawakStage(ctx) === 'choose') {
      return {
        type: 'choose_answer',
        payload: { answerIndex: ctx.random.int(3) },
      };
    }
    const targets = Object.keys(ctx.submissions.values<number>('nawak.answers'))
      .map(Number)
      .filter((playerId) => playerId !== actor.id);
    const targetPlayerId = ctx.random.pick(targets);
    return targetPlayerId == null
      ? null
      : { type: 'vote_answer', payload: { targetPlayerId } };
  },
};
