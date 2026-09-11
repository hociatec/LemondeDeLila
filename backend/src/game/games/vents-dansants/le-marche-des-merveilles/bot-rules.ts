import type { GameBotDefinition } from '../../../engine/sdk/public-api';
import { WONDER_GOODS } from './content';
import { MARKET_ACTIONS } from './rules';
import type { WonderMarketState } from './types';
export const GAME_BOT: GameBotDefinition<
  WonderMarketState,
  typeof MARKET_ACTIONS
> = {
  choose: ({ actor, ctx }) => {
    const sellable = WONDER_GOODS.find((good) =>
      ctx.inventory.has('wonder-goods', actor.id, good),
    );
    if (sellable) return { type: 'sell', payload: { good: sellable } };
    const buyable = [...WONDER_GOODS]
      .sort(
        (left, right) =>
          ctx.economy.price('wonders', right) -
            ctx.economy.price('wonders', left) ||
          WONDER_GOODS.indexOf(left) - WONDER_GOODS.indexOf(right),
      )
      .find((good) => ctx.economy.canAfford('wonders', actor.id, good));
    return buyable
      ? { type: 'buy', payload: { good: buyable } }
      : { type: 'pass', payload: {} };
  },
};
