import {
  commonStatuses,
  defineGame,
  marketGame,
  playerView,
} from '../../../core/application/public-api';
import {
  GOOD_LABELS,
  INITIAL_PRICES,
  MARKET_RULES,
  WONDER_GOODS,
} from './content';
import { MARKET_ACTIONS, MARKET_TURNS_TAKEN } from './rules';
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
  setup: () => ({}),
  actions: MARKET_ACTIONS,
  view: ({ state: _state, actor, ctx }) => {
    const prices = ctx.economy.prices('wonders');
    const myInventory = actor
      ? ctx.inventory.quantities('wonder-goods', actor.id)
      : {};
    const marketLines = WONDER_GOODS.map(
      (good) => `${GOOD_LABELS[good]} : ${prices[good]} pièces`,
    );
    const playerLines = ctx.players.all().map((player) => {
      const coins = ctx.resources.get(player.id, 'coins');
      const value = ctx.economy.netWorth('wonders', player.id);
      return `${player.username} : ${coins} pièces, valeur ${value}${ctx.status.has(player.id, commonStatuses.protected) ? ', étal protégé' : ''}`;
    });
    return playerView({
      game: {
        turnsTaken: ctx.counters.get(MARKET_TURNS_TAKEN),
        lastMarketEvent: ctx.events.latestMessage(),
        maxRounds: MARKET_RULES.maxRounds,
        protectedPlayers: ctx.players.byId((player) =>
          ctx.status.has(player.id, commonStatuses.protected),
        ),
      },
      extras: {
        market: marketLines,
        round: ctx.round.number,
        maxRounds: MARKET_RULES.maxRounds,
        lastMarketEvent: ctx.events.latestMessage(),
        ui: {
          panels: [
            { title: 'Marché', lines: marketLines },
            { title: 'Marchands', lines: playerLines },
            {
              title: 'Mon étal',
              lines: WONDER_GOODS.map(
                (good) => `${GOOD_LABELS[good]} : ${myInventory[good] ?? 0}`,
              ),
            },
          ],
        },
      },
    });
  },
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
