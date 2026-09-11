import type { GameContext } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import {
  DAME_NATURE_NATURE_CARD_IDS,
  DAME_NATURE_QUIZ_CARD_IDS,
} from './content';
export const setupGame = ({
  ctx,
}: {
  ctx: GameContext<NoGameState>;
  players: ReturnType<GameContext<NoGameState>['players']['all']>;
}): NoGameState => {
  ctx.cards.putOnTop('nature', [
    ...DAME_NATURE_QUIZ_CARD_IDS,
    ...DAME_NATURE_NATURE_CARD_IDS,
  ]);
  ctx.cards.shuffle('nature');
  return {};
};
