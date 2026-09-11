import type {
  GameBotDefinition,
  NoGameState as OlympiaState,
} from '../../../engine/sdk/public-api';
import { OLYMPIA_ACTIONS } from './rules';
export const GAME_BOT: GameBotDefinition<OlympiaState, typeof OLYMPIA_ACTIONS> =
  {
    choose: ({ actor, ctx }) => {
      const cardId = ctx.cards.hand<string>('players', actor.id)[0];
      return cardId
        ? { type: 'play_card', payload: { cardId } }
        : { type: 'pass', payload: {} };
    },
  };
