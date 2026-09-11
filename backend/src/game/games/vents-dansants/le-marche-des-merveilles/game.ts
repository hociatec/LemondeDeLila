import {
  defineGame,
  marketGame,
  publicField,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  INITIAL_PRICES,
  MARKET_RULES,
  WONDER_GAME_CONTENT,
  WONDER_GOODS,
} from './content';
import manifest from './manifest.json';
import { MARKET_ACTIONS, MARKET_TURNS_TAKEN } from './rules';
import type { WonderMarketState } from './types';

export default defineGame<WonderMarketState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: WONDER_GAME_CONTENT,
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
  bot: GAME_BOT,
});
