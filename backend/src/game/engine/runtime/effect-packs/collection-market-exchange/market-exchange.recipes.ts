import type { MarketExchangeProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { commonStatuses } from '../../kits/player-values-contracts';

type State = Record<string, never>;
type Context = GameContext<State>;

export function marketExchangeRules(source: MarketExchangeProgram) {
  const program = structuredClone(source);
  const good = gameInput.enum(program.goods);
  return {
    buy: defineAction<State, { good: string }>({
      input: gameInput.object({ good }),
      validate: ({ actor, input, ctx }) =>
        ctx.economy.canAfford(program.marketId, actor.id, input.good),
      enumerate: ({ actor, ctx }) =>
        program.goods
          .filter((item) =>
            ctx.economy.canAfford(program.marketId, actor.id, item),
          )
          .map((item) => ({ good: item })),
      execute: ({ actor, input, ctx }) => {
        begin(actor.id, ctx);
        const price = ctx.economy.buy(program.marketId, actor.id, input.good, {
          priceDelta: 1,
        });
        ctx.events.message(`${program.eventNamespace}.good.bought`, {
          playerId: actor.id,
          goodId: input.good,
          price,
          nextPrice: ctx.economy.price(program.marketId, input.good),
        });
        advance(program, ctx);
      },
    }),
    sell: defineAction<State, { good: string }>({
      input: gameInput.object({ good }),
      validate: ({ actor, input, ctx }) =>
        ctx.economy.canSell(program.marketId, actor.id, input.good),
      enumerate: ({ actor, ctx }) =>
        program.goods
          .filter((item) =>
            ctx.economy.canSell(program.marketId, actor.id, item),
          )
          .map((item) => ({ good: item })),
      execute: ({ actor, input, ctx }) => {
        begin(actor.id, ctx);
        const price = ctx.economy.sell(program.marketId, actor.id, input.good, {
          priceDelta: -1,
        });
        ctx.events.message(`${program.eventNamespace}.good.sold`, {
          playerId: actor.id,
          goodId: input.good,
          price,
          nextPrice: ctx.economy.price(program.marketId, input.good),
        });
        advance(program, ctx);
      },
    }),
    rumor: defineAction<State, { good: string; direction: 'up' | 'down' }>({
      input: gameInput.object({
        good,
        direction: gameInput.enum(['up', 'down']),
      }),
      available: ({ actor, ctx }) =>
        ctx.resources.has(actor.id, program.currency, program.rumorCost),
      validate: ({ input }) => program.goods.includes(input.good),
      enumerate: () =>
        program.goods.flatMap((item) => [
          { good: item, direction: 'up' as const },
          { good: item, direction: 'down' as const },
        ]),
      execute: ({ actor, input, ctx }) => {
        begin(actor.id, ctx);
        ctx.economy.pay(program.marketId, actor.id, program.rumorCost);
        const price = ctx.economy.adjustPrice(
          program.marketId,
          input.good,
          input.direction === 'up' ? 2 : -2,
        );
        ctx.events.message(`${program.eventNamespace}.rumor.started`, {
          playerId: actor.id,
          goodId: input.good,
          direction: input.direction,
          price,
        });
        advance(program, ctx);
      },
    }),
    protect: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ actor, ctx }) =>
        ctx.resources.has(actor.id, program.currency, program.protectCost) &&
        !ctx.status.has(actor.id, commonStatuses.protected),
      execute: ({ actor, ctx }) => {
        begin(actor.id, ctx);
        ctx.economy.pay(program.marketId, actor.id, program.protectCost);
        ctx.status.add(actor.id, commonStatuses.protected, {
          scope: 'until-used',
        });
        ctx.events.message(`${program.eventNamespace}.stall.protected`, {
          playerId: actor.id,
        });
        advance(program, ctx);
      },
    }),
    steal: defineAction<State, { targetPlayerId: number; good: string }>({
      input: gameInput.object({ targetPlayerId: gameInput.playerId(), good }),
      validate: ({ actor, input, ctx }) =>
        input.targetPlayerId !== actor.id &&
        ctx.players.get(input.targetPlayerId) != null &&
        !ctx.status.has(input.targetPlayerId, commonStatuses.protected) &&
        ctx.inventory.has(
          program.inventoryId,
          input.targetPlayerId,
          input.good,
        ),
      enumerate: ({ actor, ctx }) =>
        ctx.players
          .others(actor.id)
          .flatMap((target) =>
            ctx.status.has(target.id, commonStatuses.protected)
              ? []
              : program.goods
                  .filter((item) =>
                    ctx.inventory.has(program.inventoryId, target.id, item),
                  )
                  .map((item) => ({ targetPlayerId: target.id, good: item })),
          ),
      execute: ({ actor, input, ctx }) => {
        begin(actor.id, ctx);
        ctx.inventory.transfer(
          program.inventoryId,
          input.targetPlayerId,
          actor.id,
          input.good,
        );
        ctx.events.message(`${program.eventNamespace}.good.stolen`, {
          playerId: actor.id,
          targetPlayerId: input.targetPlayerId,
          goodId: input.good,
        });
        advance(program, ctx);
      },
    }),
    pass: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        begin(actor.id, ctx);
        ctx.events.message(`${program.eventNamespace}.player.passed`, {
          playerId: actor.id,
        });
        advance(program, ctx);
      },
    }),
    choose: (playerId: number, ctx: Context) => choose(program, playerId, ctx),
  };
}
function begin(playerId: number, ctx: Context): void {
  ctx.status.remove(playerId, commonStatuses.protected);
}

function advance(program: MarketExchangeProgram, ctx: Context): void {
  const playerCount = ctx.players.count();
  const turns = ctx.counters.add(program.turnsCounterId, 1);
  if (turns >= playerCount * program.maxRounds) return ctx.round.end();
  if (turns % playerCount === 0) {
    const starterId = ctx.round.starter() ?? ctx.players.all()[0]?.id;
    ctx.round.end();
    ctx.round.start(starterId);
  }
  ctx.turn.end();
}

function choose(
  program: MarketExchangeProgram,
  playerId: number,
  ctx: Context,
) {
  const sell = program.goods.find((good) =>
    ctx.inventory.has(program.inventoryId, playerId, good),
  );
  if (sell)
    return {
      recipe: 'collection-market-exchange-sell' as const,
      payload: { good: sell },
    };
  const buy = [...program.goods]
    .sort(
      (left, right) =>
        ctx.economy.price(program.marketId, right) -
          ctx.economy.price(program.marketId, left) ||
        program.goods.indexOf(left) - program.goods.indexOf(right),
    )
    .find((good) => ctx.economy.canAfford(program.marketId, playerId, good));
  return buy
    ? {
        recipe: 'collection-market-exchange-buy' as const,
        payload: { good: buy },
      }
    : { recipe: 'collection-market-exchange-pass' as const, payload: {} };
}
