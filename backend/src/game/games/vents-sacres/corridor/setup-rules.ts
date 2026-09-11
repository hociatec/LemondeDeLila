import type { GameContext } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import { CORRIDOR_SIZE } from './content';
export const setupGame = ({
  players,
  ctx,
}: {
  ctx: GameContext<NoGameState>;
  players: ReturnType<GameContext<NoGameState>['players']['all']>;
}): NoGameState => {
  const center = Math.floor(CORRIDOR_SIZE / 2);
  ctx.grid.set('corridor', { x: center, y: 0 }, players[0].id);
  ctx.grid.set('corridor', { x: center, y: CORRIDOR_SIZE - 1 }, players[1].id);
  ctx.grid.setOverlays('corridor', 'walls', []);
  return {};
};
