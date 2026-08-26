import {
  defineGame,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  GOOD_LABELS,
  INITIAL_PRICES,
  MARKET_RULES,
  WONDER_GOODS,
} from './content';
import {
  emptyInventory,
  inventoryValue,
  MARKET_ACTIONS,
  marketWinners,
} from './rules';
import type { WonderMarketPlayerView, WonderMarketState } from './state';

export default defineGame<
  WonderMarketState,
  typeof MARKET_ACTIONS,
  WonderMarketPlayerView
>({
  id: 'le-marche-des-merveilles',
  displayName: 'Le Marché des Merveilles',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Achetez, vendez et influencez les cours du marché.',
  players: { min: 2, max: 6 },
  shortcuts: [
    { key: 'A', type: 'action', actionType: 'buy' },
    { key: 'Q', type: 'action', actionType: 'sell' },
    { key: 'R', type: 'action', actionType: 'rumor' },
    { key: 'P', type: 'action', actionType: 'protect' },
    { key: 'V', type: 'action', actionType: 'steal_deal' },
    { key: 'O', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players }) => ({
    round: 1,
    maxRounds: MARKET_RULES.maxRounds,
    turnsTaken: 0,
    prices: structuredClone(INITIAL_PRICES),
    coins: Object.fromEntries(
      players.map((player) => [player.id, MARKET_RULES.startingCoins]),
    ),
    inventories: Object.fromEntries(
      players.map((player) => [player.id, emptyInventory()]),
    ),
    protectedPlayers: Object.fromEntries(
      players.map((player) => [player.id, false]),
    ),
    lastMarketEvent: null,
    winnerId: null,
  }),
  turn: standardTurn(),
  actions: MARKET_ACTIONS,
  victory: victoryWhen(({ state }) => {
    if (state.winnerId == null) return null;
    return { winnerPlayerIds: marketWinners(state), reason: 'market-closed' };
  }),
  view: ({ state, actor, ctx }) => {
    const myInventory = actor ? state.inventories[actor.id] : emptyInventory();
    const marketLines = WONDER_GOODS.map(
      (good) => `${GOOD_LABELS[good]} : ${state.prices[good]} pièces`,
    );
    const playerLines = ctx.players.all().map((player) => {
      const value =
        state.coins[player.id] +
        inventoryValue(state.inventories[player.id], state.prices);
      return `${player.username} : ${state.coins[player.id]} pièces, valeur ${value}${state.protectedPlayers[player.id] ? ', étal protégé' : ''}`;
    });
    return playerView({
      game: {
        ...structuredClone(state),
        myInventory: structuredClone(myInventory),
      },
      extras: {
        market: marketLines,
        prices: structuredClone(state.prices),
        coins: structuredClone(state.coins),
        inventories: structuredClone(state.inventories),
        myInventory: structuredClone(myInventory),
        round: state.round,
        maxRounds: state.maxRounds,
        lastMarketEvent: state.lastMarketEvent,
        ui: {
          panels: [
            { title: 'Marché', lines: marketLines },
            { title: 'Marchands', lines: playerLines },
            {
              title: 'Mon étal',
              lines: WONDER_GOODS.map(
                (good) => `${GOOD_LABELS[good]} : ${myInventory[good]}`,
              ),
            },
          ],
        },
      },
    });
  },
  bot: {
    choose: ({ state, actor }) => {
      const sellable = WONDER_GOODS.find(
        (good) => state.inventories[actor.id][good] > 0,
      );
      if (sellable) return { type: 'sell', payload: { good: sellable } };
      const buyable = [...WONDER_GOODS]
        .sort((left, right) => state.prices[right] - state.prices[left])
        .find((good) => state.coins[actor.id] >= state.prices[good]);
      return buyable
        ? { type: 'buy', payload: { good: buyable } }
        : { type: 'pass', payload: {} };
    },
  },
});
