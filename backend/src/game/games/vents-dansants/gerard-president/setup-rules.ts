import type { GameContext } from '../../../engine/sdk/public-api';
import type { GerardState } from './state';
import { GERARD_JUDGE } from './game-constants';
export const setupGame = ({
  players,
  ctx,
}: {
  ctx: GameContext<GerardState>;
  players: ReturnType<GameContext<GerardState>['players']['all']>;
}): GerardState => {
  ctx.submissionFlow.startJudge(GERARD_JUDGE, {
    players: players.map((player) => player.id),
  });
  return {
    currentThemeId: null,
    secondThemeId: null,
    lockedNameId: null,
  };
};
