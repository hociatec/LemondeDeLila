import type { GameContext } from '../../../engine/sdk/public-api';
import { dealFamilyHands } from './rules';
import type { EntreRitesState } from './types';
export const setupGame = ({
  players,
  ctx,
}: {
  ctx: GameContext<EntreRitesState>;
  players: ReturnType<GameContext<EntreRitesState>['players']['all']>;
}): EntreRitesState => {
  dealFamilyHands(
    players.map((player) => player.id),
    ctx,
  );
  return {};
};
