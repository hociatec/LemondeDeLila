import { defineAction, defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameContext } from '../definitions/game-author-context';
import { commonStatuses } from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';
import { marketGame } from './gameplay-pattern-round-economy';

type State = Record<string, never>;
type Context = GameContext<State>;

export type MarketExchangeOptions = {
  marketId: string;
  inventoryId: string;
  items: readonly string[];
  currency: string;
  prices: Readonly<Record<string, number>>;
  startingCurrency: number;
  minPrice: number;
  maxPrice: number;
  turnsCounterId: string;
  maxRounds: number;
  winnerReason: string;
  exchange: {
    buyRecipe: string;
    sellRecipe: string;
    rumorRecipe: string;
    protectRecipe: string;
    stealRecipe: string;
    passRecipe: string;
    buyAction: string;
    sellAction: string;
    passAction: string;
    rumorCost: number;
    protectCost: number;
    eventNamespace: string;
  };
};

export function marketExchange(source: MarketExchangeOptions) {
  const options = structuredClone(source);
  const exchange = options.exchange;
  const base = marketGame<State, string, string>(options);
  const good = gameInput.enum(options.items);
  const begin = (playerId: number, ctx: Context) =>
    ctx.status.remove(playerId, commonStatuses.protected);
  const advance = (ctx: Context) => {
    const playerCount = ctx.players.count();
    const turns = ctx.counters.add(options.turnsCounterId, 1);
    if (turns >= playerCount * options.maxRounds) return ctx.round.end();
    if (turns % playerCount === 0) {
      const starterId = ctx.round.starter() ?? ctx.players.all()[0]?.id;
      ctx.round.end();
      ctx.round.start(starterId);
    }
    ctx.turn.end();
  };
  return definePattern({
    ...base,
    id: `market-exchange:${options.marketId}`,
    mechanics: [...base.mechanics, 'rumor', 'protection', 'steal'],
    actions: {
      [exchange.buyRecipe]: defineAction<State, { good: string }>({
        input: gameInput.object({ good }),
        validate: ({ actor, input, ctx }) =>
          ctx.economy.canAfford(options.marketId, actor.id, input.good),
        enumerate: ({ actor, ctx }) =>
          options.items
            .filter((item) =>
              ctx.economy.canAfford(options.marketId, actor.id, item),
            )
            .map((item) => ({ good: item })),
        execute: ({ actor, input, ctx }) => {
          begin(actor.id, ctx);
          const price = ctx.economy.buy(
            options.marketId,
            actor.id,
            input.good,
            { priceDelta: 1 },
          );
          ctx.events.message(`${exchange.eventNamespace}.good.bought`, {
            playerId: actor.id,
            goodId: input.good,
            price,
            nextPrice: ctx.economy.price(options.marketId, input.good),
          });
          advance(ctx);
        },
      }),
      [exchange.sellRecipe]: defineAction<State, { good: string }>({
        input: gameInput.object({ good }),
        validate: ({ actor, input, ctx }) =>
          ctx.economy.canSell(options.marketId, actor.id, input.good),
        enumerate: ({ actor, ctx }) =>
          options.items
            .filter((item) =>
              ctx.economy.canSell(options.marketId, actor.id, item),
            )
            .map((item) => ({ good: item })),
        execute: ({ actor, input, ctx }) => {
          begin(actor.id, ctx);
          const price = ctx.economy.sell(
            options.marketId,
            actor.id,
            input.good,
            { priceDelta: -1 },
          );
          ctx.events.message(`${exchange.eventNamespace}.good.sold`, {
            playerId: actor.id,
            goodId: input.good,
            price,
            nextPrice: ctx.economy.price(options.marketId, input.good),
          });
          advance(ctx);
        },
      }),
      [exchange.rumorRecipe]: defineAction<
        State,
        { good: string; direction: 'up' | 'down' }
      >({
        input: gameInput.object({
          good,
          direction: gameInput.enum(['up', 'down']),
        }),
        available: ({ actor, ctx }) =>
          ctx.resources.has(actor.id, options.currency, exchange.rumorCost),
        validate: ({ input }) => options.items.includes(input.good),
        enumerate: () =>
          options.items.flatMap((item) => [
            { good: item, direction: 'up' as const },
            { good: item, direction: 'down' as const },
          ]),
        execute: ({ actor, input, ctx }) => {
          begin(actor.id, ctx);
          ctx.economy.pay(options.marketId, actor.id, exchange.rumorCost);
          const price = ctx.economy.adjustPrice(
            options.marketId,
            input.good,
            input.direction === 'up' ? 2 : -2,
          );
          ctx.events.message(`${exchange.eventNamespace}.rumor.started`, {
            playerId: actor.id,
            goodId: input.good,
            direction: input.direction,
            price,
          });
          advance(ctx);
        },
      }),
      [exchange.protectRecipe]: defineEmptyAction<State>({
        available: ({ actor, ctx }) =>
          ctx.resources.has(actor.id, options.currency, exchange.protectCost) &&
          !ctx.status.has(actor.id, commonStatuses.protected),
        execute: ({ actor, ctx }) => {
          begin(actor.id, ctx);
          ctx.economy.pay(options.marketId, actor.id, exchange.protectCost);
          ctx.status.add(actor.id, commonStatuses.protected, {
            scope: 'until-used',
          });
          ctx.events.message(`${exchange.eventNamespace}.stall.protected`, {
            playerId: actor.id,
          });
          advance(ctx);
        },
      }),
      [exchange.stealRecipe]: defineAction<
        State,
        { targetPlayerId: number; good: string }
      >({
        input: gameInput.object({ targetPlayerId: gameInput.playerId(), good }),
        validate: ({ actor, input, ctx }) =>
          input.targetPlayerId !== actor.id &&
          ctx.players.get(input.targetPlayerId) != null &&
          !ctx.status.has(input.targetPlayerId, commonStatuses.protected) &&
          ctx.inventory.has(
            options.inventoryId,
            input.targetPlayerId,
            input.good,
          ),
        enumerate: ({ actor, ctx }) =>
          ctx.players
            .others(actor.id)
            .flatMap((target) =>
              ctx.status.has(target.id, commonStatuses.protected)
                ? []
                : options.items
                    .filter((item) =>
                      ctx.inventory.has(options.inventoryId, target.id, item),
                    )
                    .map((item) => ({ targetPlayerId: target.id, good: item })),
            ),
        execute: ({ actor, input, ctx }) => {
          begin(actor.id, ctx);
          ctx.inventory.transfer(
            options.inventoryId,
            input.targetPlayerId,
            actor.id,
            input.good,
          );
          ctx.events.message(`${exchange.eventNamespace}.good.stolen`, {
            playerId: actor.id,
            targetPlayerId: input.targetPlayerId,
            goodId: input.good,
          });
          advance(ctx);
        },
      }),
      [exchange.passRecipe]: defineEmptyAction<State>({
        execute: ({ actor, ctx }) => {
          begin(actor.id, ctx);
          ctx.events.message(`${exchange.eventNamespace}.player.passed`, {
            playerId: actor.id,
          });
          advance(ctx);
        },
      }),
    },
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const sell = options.items.find((item) =>
          ctx.inventory.has(options.inventoryId, actor.id, item),
        );
        if (sell && availableActions.includes(exchange.sellAction))
          return { type: exchange.sellAction, payload: { good: sell } };
        const buy = [...options.items]
          .sort(
            (left, right) =>
              ctx.economy.price(options.marketId, right) -
                ctx.economy.price(options.marketId, left) ||
              options.items.indexOf(left) - options.items.indexOf(right),
          )
          .find((item) =>
            ctx.economy.canAfford(options.marketId, actor.id, item),
          );
        if (buy && availableActions.includes(exchange.buyAction))
          return { type: exchange.buyAction, payload: { good: buy } };
        return availableActions.includes(exchange.passAction)
          ? { type: exchange.passAction, payload: {} }
          : null;
      },
    },
  });
}
