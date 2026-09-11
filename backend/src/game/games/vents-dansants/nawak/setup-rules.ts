import type { GameContext } from '../../../engine/sdk/public-api';
import { NAWAK_CHALLENGES } from './content';
import type { NawakState } from './state';
export const setupGame = ({
  ctx,
}: {
  ctx: GameContext<NawakState>;
  players: ReturnType<GameContext<NawakState>['players']['all']>;
}): NawakState => {
  ctx.submissionFlow.open({
    id: 'nawak.answers',
    secret: true,
    waitForAll: true,
  });
  return {
    currentChallengeId: (
      ctx.random.pick(NAWAK_CHALLENGES) ?? NAWAK_CHALLENGES[0]
    ).id,
    lastRound: null,
  };
};
