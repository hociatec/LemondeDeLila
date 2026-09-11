import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { type NoGameState } from '../../../engine/sdk/public-api';
import { CORRIDOR_ACTIONS, legalMoves } from './rules';
import type { CorridorPosition } from './types';
export const GAME_BOT: GameBotDefinition<NoGameState, typeof CORRIDOR_ACTIONS> =
  {
    choose: ({ state, actor, ctx }) => {
      const move = legalMoves(state, actor.id, ctx)[0] as
        CorridorPosition | undefined;
      return move
        ? { type: 'corridor_move', payload: { x: move.x, y: move.y } }
        : null;
    },
  };
