import type {
  GameBotDefinition,
  NoGameState as MorpionState,
} from '../../../engine/sdk/public-api';
import { chooseBotMove, MORPION_ACTIONS } from './rules';
export const GAME_BOT: GameBotDefinition<MorpionState, typeof MORPION_ACTIONS> =
  {
    choose: ({ state: _state, actor, ctx }) => {
      const opponentId =
        ctx.players.all().find((player) => player.id !== actor.id)?.id ?? null;
      const move = chooseBotMove(ctx, actor.id, opponentId);
      return move ? { type: 'morpion_play', payload: move } : null;
    },
  };
