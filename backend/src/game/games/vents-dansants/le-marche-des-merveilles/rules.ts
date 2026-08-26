import { defineAction, gameInput } from '../../../core/application/public-api';
import {
  EMPTY_INVENTORY,
  GOOD_LABELS,
  MARKET_RULES,
  WONDER_GOODS,
} from './content';
import type {
  WonderGood,
  WonderInventory,
  WonderMarketState,
  WonderPrices,
} from './state';

const goodSchema = gameInput.enum(WONDER_GOODS);

export const buy = defineAction<WonderMarketState, { good: WonderGood }>({
  input: gameInput.object({ good: goodSchema }),
  availableInputs: ({ state, actor }) =>
    WONDER_GOODS.filter(
      (good) => state.coins[actor.id] >= state.prices[good],
    ).map((good) => ({ good })),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(state, actor.id);
    const price = state.prices[input.good];
    state.coins[actor.id] -= price;
    state.inventories[actor.id][input.good] += 1;
    state.prices[input.good] = clampPrice(price + 1);
    state.lastMarketEvent = `${GOOD_LABELS[input.good]} monte à ${state.prices[input.good]}.`;
    ctx.history.add(
      `${actor.username} achète ${GOOD_LABELS[input.good]} pour ${price} pièces.`,
    );
    finishAction(state, ctx);
  },
});

export const sell = defineAction<WonderMarketState, { good: WonderGood }>({
  input: gameInput.object({ good: goodSchema }),
  availableInputs: ({ state, actor }) =>
    WONDER_GOODS.filter((good) => state.inventories[actor.id][good] > 0).map(
      (good) => ({ good }),
    ),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(state, actor.id);
    const price = state.prices[input.good];
    state.inventories[actor.id][input.good] -= 1;
    state.coins[actor.id] += price;
    state.prices[input.good] = clampPrice(price - 1);
    state.lastMarketEvent = `${GOOD_LABELS[input.good]} baisse à ${state.prices[input.good]}.`;
    ctx.history.add(
      `${actor.username} vend ${GOOD_LABELS[input.good]} pour ${price} pièces.`,
    );
    finishAction(state, ctx);
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
  available: ({ state, actor }) =>
    state.coins[actor.id] >= MARKET_RULES.rumorCost,
  availableInputs: () =>
    WONDER_GOODS.flatMap((good) => [
      { good, direction: 'up' as const },
      { good, direction: 'down' as const },
    ]),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(state, actor.id);
    state.coins[actor.id] -= MARKET_RULES.rumorCost;
    const delta = input.direction === 'up' ? 2 : -2;
    state.prices[input.good] = clampPrice(state.prices[input.good] + delta);
    state.lastMarketEvent = `Rumeur sur ${GOOD_LABELS[input.good]} : ${state.prices[input.good]}.`;
    ctx.history.add(
      `${actor.username} lance une rumeur sur ${GOOD_LABELS[input.good]}.`,
    );
    finishAction(state, ctx);
  },
});

export const protect = defineAction<WonderMarketState, Record<string, never>>({
  input: gameInput.object({}),
  available: ({ state, actor }) =>
    state.coins[actor.id] >= MARKET_RULES.protectCost &&
    !state.protectedPlayers[actor.id],
  execute: ({ state, actor, ctx }) => {
    beginAction(state, actor.id);
    state.coins[actor.id] -= MARKET_RULES.protectCost;
    state.protectedPlayers[actor.id] = true;
    state.lastMarketEvent = 'Un étal est sous bonne garde.';
    ctx.history.add(`${actor.username} protège son étal.`);
    finishAction(state, ctx);
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
  availableInputs: ({ state, actor, ctx }) =>
    ctx.players
      .all()
      .flatMap((target) =>
        target.id === actor.id || state.protectedPlayers[target.id]
          ? []
          : WONDER_GOODS.filter(
              (good) => state.inventories[target.id][good] > 0,
            ).map((good) => ({ targetPlayerId: target.id, good })),
      ),
  execute: ({ state, actor, input, ctx }) => {
    beginAction(state, actor.id);
    state.inventories[input.targetPlayerId][input.good] -= 1;
    state.inventories[actor.id][input.good] += 1;
    state.lastMarketEvent = `${GOOD_LABELS[input.good]} change discrètement de main.`;
    ctx.history.add(`${actor.username} vole ${GOOD_LABELS[input.good]}.`);
    finishAction(state, ctx);
  },
});

export const pass = defineAction<WonderMarketState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ state, actor, ctx }) => {
    beginAction(state, actor.id);
    ctx.history.add(`${actor.username} observe le marché.`);
    finishAction(state, ctx);
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

export function inventoryValue(
  inventory: WonderInventory,
  prices: WonderPrices,
): number {
  return WONDER_GOODS.reduce(
    (total, good) => total + inventory[good] * prices[good],
    0,
  );
}

export function marketWinners(state: WonderMarketState): number[] {
  const entries = Object.keys(state.coins)
    .map(Number)
    .map((playerId) => ({
      playerId,
      score:
        state.coins[playerId] +
        inventoryValue(state.inventories[playerId], state.prices),
    }));
  const best = Math.max(...entries.map((entry) => entry.score));
  return entries
    .filter((entry) => entry.score === best)
    .map((entry) => entry.playerId);
}

export function emptyInventory(): WonderInventory {
  return structuredClone(EMPTY_INVENTORY);
}

function beginAction(state: WonderMarketState, playerId: number): void {
  state.protectedPlayers[playerId] = false;
}

function finishAction(
  state: WonderMarketState,
  ctx: { players: { all(): Array<{ id: number }> }; turn: { end(): void } },
): void {
  state.turnsTaken += 1;
  state.round = Math.min(
    state.maxRounds,
    Math.floor(state.turnsTaken / ctx.players.all().length) + 1,
  );
  if (state.turnsTaken >= ctx.players.all().length * state.maxRounds) {
    state.winnerId = marketWinners(state)[0] ?? null;
  } else {
    ctx.turn.end();
  }
}

function clampPrice(value: number): number {
  return Math.max(1, Math.min(10, Math.trunc(value)));
}
