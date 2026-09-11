import type { GameContext } from '../../../engine/sdk/public-api';
import type { PimpMyRideState } from './state';
export const setupGame = ({
  ctx,
}: {
  ctx: GameContext<PimpMyRideState>;
  players: ReturnType<GameContext<PimpMyRideState>['players']['all']>;
}): PimpMyRideState => {
  return {
    completedCars: ctx.players.byId(() => []),
  };
};
