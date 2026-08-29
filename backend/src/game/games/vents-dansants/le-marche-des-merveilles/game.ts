import {
  defineGameContent,
  defineGame,
  marketGame,
  publicField,
} from '../../../engine/sdk/public-api';
import {
  GOOD_LABELS,
  INITIAL_PRICES,
  MARKET_RULES,
  WONDER_GOODS,
} from './content';
import { MARKET_ACTIONS, MARKET_TURNS_TAKEN } from './rules';
import type { WonderMarketState } from './types';

export default defineGame<WonderMarketState, typeof MARKET_ACTIONS>({
  id: 'le-marche-des-merveilles',
  displayName: 'Le Marché des Merveilles',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Achetez, vendez et influencez les cours du marché.',
  players: { min: 2, max: 6 },
  content: defineGameContent('le-marche-des-merveilles', {
    goods: WONDER_GOODS,
    labels: GOOD_LABELS,
    initialPrices: INITIAL_PRICES,
    rules: MARKET_RULES,
  }),
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    marketGame({
      marketId: 'wonders',
      inventoryId: 'wonder-goods',
      items: WONDER_GOODS,
      currency: 'coins',
      prices: INITIAL_PRICES,
      startingCurrency: MARKET_RULES.startingCoins,
      minPrice: 1,
      maxPrice: 10,
      turnsCounterId: MARKET_TURNS_TAKEN,
      maxRounds: MARKET_RULES.maxRounds,
      winnerReason: 'market-closed',
    }),
  ],
  shortcuts: [
    { key: 'A', type: 'action', actionType: 'buy' },
    { key: 'Q', type: 'action', actionType: 'sell' },
    { key: 'R', type: 'action', actionType: 'rumor' },
    { key: 'P', type: 'action', actionType: 'protect' },
    { key: 'V', type: 'action', actionType: 'steal_deal' },
    { key: 'O', type: 'action', actionType: 'pass' },
  ],
  actions: MARKET_ACTIONS,
  bot: {
    choose: ({ actor, ctx }) => {
      const sellable = WONDER_GOODS.find((good) =>
        ctx.inventory.has('wonder-goods', actor.id, good),
      );
      if (sellable) return { type: 'sell', payload: { good: sellable } };
      const buyable = [...WONDER_GOODS]
        .sort(
          (left, right) =>
            ctx.economy.price('wonders', right) -
            ctx.economy.price('wonders', left),
        )
        .find((good) => ctx.economy.canAfford('wonders', actor.id, good));
      return buyable
        ? { type: 'buy', payload: { good: buyable } }
        : { type: 'pass', payload: {} };
    },
  },
});
