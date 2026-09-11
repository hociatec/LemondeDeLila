import type {
  GameContext,
  NoGameState as LesMainsState,
} from '../../../engine/sdk/public-api';
import { dealProfessionHands } from './rules';
export const setupGame = ({
  players,
  ctx,
}: {
  ctx: GameContext<LesMainsState>;
  players: ReturnType<GameContext<LesMainsState>['players']['all']>;
}): LesMainsState => {
  dealProfessionHands(
    players.map((player) => player.id),
    ctx,
  );
  return {};
};
