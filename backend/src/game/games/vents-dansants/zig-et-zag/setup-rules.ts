import type { GameContext } from '../../../engine/sdk/public-api';
import { createRound } from './rules';
import type { ZigEtZagState } from './state';
export const setupGame = ({
  ctx,
}: {
  ctx: GameContext<ZigEtZagState>;
  players: ReturnType<GameContext<ZigEtZagState>['players']['all']>;
}): ZigEtZagState => {
  const round = createRound(ctx);
  return {
    battle: round,
    lastRound: null,
  };
};
