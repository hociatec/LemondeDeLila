import {
  commonStatuses,
  defineAction,
  gameInput,
  type GameContext,
} from '../../../core/application/public-api';
import { MARKET_RULES, WONDER_GOODS } from './content';
import type { WonderGood, WonderMarketState } from './state';

const goodSchema = gameInput.enum(WONDER_GOODS);
const MARKET = 'wonders';
const INVENTORY = 'wonder-goods';
const CURRENCY = 'coins';
export const MARKET_TURNS_TAKEN = 'wonder-market.turns-taken';

export const buy = defineAction<WonderMarketState, { good: WonderGood }>({
  input: gameInput.object({ good: goodSchema }),
  validate: ({ actor, input, ctx }) =>
    ctx.economy.canAfford(MARKET, actor.id, input.good),
  enumerate: ({ actor, ctx }) =>
    WONDER_GOODS.filter((good) =>
      ctx.economy.canAfford(MARKET, actor.id, good),
    ).map((good) => ({ good })),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(actor.id, ctx);
    const price = ctx.economy.buy(MARKET, actor.id, input.good, {
      priceDelta: 1,
    });
    const nextPrice = ctx.economy.price(MARKET, input.good);
    ctx.events.message('wonder-market.good.bought', {
      playerId: actor.id,
      goodId: input.good,
      price,
      nextPrice,
    });
    advanceMarket(ctx);
  },
});

export const sell = defineAction<WonderMarketState, { good: WonderGood }>({
  input: gameInput.object({ good: goodSchema }),
  validate: ({ actor, input, ctx }) =>
    ctx.economy.canSell(MARKET, actor.id, input.good),
  enumerate: ({ actor, ctx }) =>
    WONDER_GOODS.filter((good) =>
      ctx.economy.canSell(MARKET, actor.id, good),
    ).map((good) => ({ good })),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(actor.id, ctx);
    const price = ctx.economy.sell(MARKET, actor.id, input.good, {
      priceDelta: -1,
    });
    const nextPrice = ctx.economy.price(MARKET, input.good);
    ctx.events.message('wonder-market.good.sold', {
      playerId: actor.id,
      goodId: input.good,
      price,
      nextPrice,
    });
    advanceMarket(ctx);
  },
});

export const rumor = defineAction<
  WonderMarketState,
  { good: WonderGood; direction: 'up' | 'down' }
>({
  input: gameInput.object({
    good: goodSchema,
    direction: gameInput.enum(['up', 'down'] as const),
  }),
  available: ({ actor, ctx }) =>
    ctx.resources.has(actor.id, CURRENCY, MARKET_RULES.rumorCost),
  validate: ({ input }) => WONDER_GOODS.includes(input.good),
  enumerate: () =>
    WONDER_GOODS.flatMap((good) => [
      { good, direction: 'up' as const },
      { good, direction: 'down' as const },
    ]),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(actor.id, ctx);
    ctx.economy.pay(MARKET, actor.id, MARKET_RULES.rumorCost);
    const delta = input.direction === 'up' ? 2 : -2;
    const price = ctx.economy.adjustPrice(MARKET, input.good, delta);
    ctx.events.message('wonder-market.rumor.started', {
      playerId: actor.id,
      goodId: input.good,
      direction: input.direction,
      price,
    });
    advanceMarket(ctx);
  },
});

export const protect = defineAction<WonderMarketState, Record<string, never>>({
  input: gameInput.object({}),
  available: ({ actor, ctx }) =>
    ctx.resources.has(actor.id, CURRENCY, MARKET_RULES.protectCost) &&
    !ctx.status.has(actor.id, commonStatuses.protected),
  execute: ({ state, actor, ctx }) => {
    beginAction(actor.id, ctx);
    ctx.economy.pay(MARKET, actor.id, MARKET_RULES.protectCost);
    ctx.status.add(actor.id, commonStatuses.protected, {
      scope: 'until-used',
    });
    ctx.events.message('wonder-market.stall.protected', {
      playerId: actor.id,
    });
    advanceMarket(ctx);
  },
});

export const stealDeal = defineAction<
  WonderMarketState,
  { targetPlayerId: number; good: WonderGood }
>({
  input: gameInput.object({
    targetPlayerId: gameInput.playerId(),
    good: goodSchema,
  }),
  validate: ({ actor, input, ctx }) =>
    input.targetPlayerId !== actor.id &&
    ctx.players.get(input.targetPlayerId) != null &&
    !ctx.status.has(input.targetPlayerId, commonStatuses.protected) &&
    ctx.inventory.has(INVENTORY, input.targetPlayerId, input.good),
  enumerate: ({ actor, ctx }) =>
    ctx.players
      .all()
      .flatMap((target) =>
        target.id === actor.id ||
        ctx.status.has(target.id, commonStatuses.protected)
          ? []
          : WONDER_GOODS.filter(
              (good) => ctx.inventory.has(INVENTORY, target.id, good),
            ).map((good) => ({ targetPlayerId: target.id, good })),
      ),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(actor.id, ctx);
    ctx.inventory.transfer(
      INVENTORY,
      input.targetPlayerId,
      actor.id,
      input.good,
    );
    ctx.events.message('wonder-market.good.stolen', {
      playerId: actor.id,
      targetPlayerId: input.targetPlayerId,
      goodId: input.good,
    });
    advanceMarket(ctx);
  },
});

export const pass = defineAction<WonderMarketState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ state, actor, ctx }) => {
    beginAction(actor.id, ctx);
    ctx.events.message('wonder-market.player.passed', {
      playerId: actor.id,
    });
    advanceMarket(ctx);
  },
});

export const MARKET_ACTIONS = {
  buy,
  sell,
  rumor,
  protect,
  steal_deal: stealDeal,
  pass,
};

export function marketWinners(
  ctx: GameContext<WonderMarketState>,
): number[] {
  return ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    { value: (playerId) => ctx.economy.netWorth(MARKET, playerId) },
  );
}

function beginAction(
  playerId: number,
  ctx: GameContext<WonderMarketState>,
): void {
  ctx.status.remove(playerId, commonStatuses.protected);
}

function advanceMarket(ctx: GameContext<WonderMarketState>): void {
  const playerCount = ctx.players.all().length;
  const turnsTaken = ctx.counters.add(MARKET_TURNS_TAKEN, 1);
  if (turnsTaken >= playerCount * MARKET_RULES.maxRounds) {
    const winners = marketWinners(ctx);
    ctx.round.end(winners);
    ctx.match.finish({ winners, reason: 'market-closed' });
    return;
  }
  if (turnsTaken % playerCount === 0) {
    const starterId = ctx.round.starter() ?? ctx.players.all()[0]?.id;
    ctx.round.end();
    ctx.round.start(starterId);
  }
  ctx.turn.end();
}
