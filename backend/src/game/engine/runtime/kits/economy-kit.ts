import {
  GameConfigurationError,
  GameNotFoundError,
  GameStateViolationError,
} from '../../../core/domain/errors/game-domain.errors';
import type { EventVisibility } from '../../../core/application/models/game-event.model';
import type { GameInventoryController } from './inventory-kit';
import type { GameResourcesController } from './player-values-kit';
import { assertGameValue } from './numeric-invariants';

export type MarketDefinition = {
  readonly component: 'economy.market';
  id: string;
  inventory: string;
  currency: string;
  prices: Readonly<Record<string, number>>;
  minPrice?: number;
  maxPrice?: number;
};

export type EconomyKitState = {
  prices: Record<string, Record<string, number>>;
};

export function createEconomyKitState(): EconomyKitState {
  return { prices: {} };
}

export const economy = {
  market(definition: Omit<MarketDefinition, 'component'>): MarketDefinition {
    const minimum = definition.minPrice ?? 0;
    const maximum = definition.maxPrice ?? Number.MAX_SAFE_INTEGER;
    if (
      !Number.isSafeInteger(minimum) ||
      minimum < 0 ||
      !Number.isSafeInteger(maximum) ||
      maximum < minimum ||
      Object.keys(definition.prices).length === 0 ||
      Object.entries(definition.prices).some(
        ([itemId, price]) =>
          !itemId.trim() ||
          !Number.isFinite(price) ||
          price < (definition.minPrice ?? 0) ||
          price > (definition.maxPrice ?? Number.MAX_SAFE_INTEGER),
      )
    ) {
      throw new GameConfigurationError(
        `Catalogue de prix invalide: ${definition.id}`,
      );
    }
    return Object.freeze({
      ...definition,
      component: 'economy.market',
      prices: Object.freeze({ ...definition.prices }),
    });
  },
};

export class GameEconomyController {
  constructor(
    private readonly state: EconomyKitState,
    private readonly resources: GameResourcesController,
    private readonly inventories: GameInventoryController,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => void = () => {},
    definitions: readonly MarketDefinition[] = [],
  ) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
  }

  private readonly definitions = new Map<string, MarketDefinition>();

  create(definition: MarketDefinition): void {
    this.definitions.set(definition.id, definition);
    this.state.prices[definition.id] = { ...definition.prices };
  }

  reset(marketId: string): void {
    this.definitions.delete(marketId);
    delete this.state.prices[marketId];
  }

  assertValid(): void {
    for (const id of Object.keys(this.state.prices)) this.requireMarket(id);
    for (const [marketId, definition] of this.definitions) {
      const prices = this.state.prices[marketId];
      if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
        throw new GameStateViolationError('Prix de marché absents', {
          marketId,
        });
      }
      if (Object.keys(prices).length !== Object.keys(definition.prices).length)
        throw new GameStateViolationError('Catalogue de prix incomplet', {
          marketId,
        });
      for (const [itemId, price] of Object.entries(prices)) {
        if (
          !Object.hasOwn(definition.prices, itemId) ||
          !Number.isFinite(price) ||
          price < (definition.minPrice ?? 0) ||
          price > (definition.maxPrice ?? Number.MAX_SAFE_INTEGER)
        ) {
          throw new GameStateViolationError('Prix de marché invalide', {
            marketId,
            itemId,
            price,
          });
        }
      }
    }
  }

  price(marketId: string, itemId: string): number {
    const price = this.state.prices[marketId]?.[itemId];
    if (price == null) {
      throw new GameNotFoundError(`Prix inconnu: ${marketId}/${itemId}`);
    }
    return price;
  }

  prices(marketId: string): Record<string, number> {
    this.requireMarket(marketId);
    return structuredClone(this.state.prices[marketId] ?? {});
  }

  setPrice(marketId: string, itemId: string, value: number): number {
    assertGameValue(value);
    const definition = this.requireMarket(marketId);
    const previous = this.price(marketId, itemId);
    const price = Math.max(
      definition.minPrice ?? 0,
      Math.min(
        definition.maxPrice ?? Number.MAX_SAFE_INTEGER,
        Math.trunc(value),
      ),
    );
    this.state.prices[marketId][itemId] = price;
    this.emit('economy.price-changed', {
      marketId,
      itemId,
      previous,
      price,
      delta: price - previous,
    });
    return price;
  }

  adjustPrice(marketId: string, itemId: string, delta: number): number {
    return this.setPrice(
      marketId,
      itemId,
      this.price(marketId, itemId) + delta,
    );
  }

  canAfford(marketId: string, playerId: number, itemId: string): boolean {
    const market = this.requireMarket(marketId);
    return this.resources.has(
      playerId,
      market.currency,
      this.price(marketId, itemId),
    );
  }

  canSell(marketId: string, playerId: number, itemId: string): boolean {
    const market = this.requireMarket(marketId);
    return this.inventories.has(market.inventory, playerId, itemId);
  }

  buy(
    marketId: string,
    playerId: number,
    itemId: string,
    options: { priceDelta?: number } = {},
  ): number {
    const market = this.requireMarket(marketId);
    const price = this.price(marketId, itemId);
    this.inventories.assertCanAdd(market.inventory, playerId, itemId);
    this.assertPriceAdjustment(price, options.priceDelta);
    this.resources.remove(playerId, market.currency, price);
    this.inventories.add(market.inventory, playerId, itemId);
    if (options.priceDelta) {
      this.adjustPrice(marketId, itemId, options.priceDelta);
    }
    this.emit('economy.item-bought', { marketId, playerId, itemId, price });
    return price;
  }

  sell(
    marketId: string,
    playerId: number,
    itemId: string,
    options: { priceDelta?: number } = {},
  ): number {
    const market = this.requireMarket(marketId);
    const price = this.price(marketId, itemId);
    assertGameValue(this.resources.get(playerId, market.currency) + price);
    this.assertPriceAdjustment(price, options.priceDelta);
    this.inventories.remove(market.inventory, playerId, itemId);
    this.resources.add(playerId, market.currency, price);
    if (options.priceDelta) {
      this.adjustPrice(marketId, itemId, options.priceDelta);
    }
    this.emit('economy.item-sold', { marketId, playerId, itemId, price });
    return price;
  }

  pay(marketId: string, playerId: number, amount: number): number {
    const market = this.requireMarket(marketId);
    return this.resources.remove(playerId, market.currency, amount);
  }

  transferPayment(
    marketId: string,
    fromPlayerId: number,
    toPlayerId: number,
    amount: number,
  ): void {
    const market = this.requireMarket(marketId);
    this.resources.transfer(fromPlayerId, toPlayerId, market.currency, amount);
  }

  inventoryValue(marketId: string, playerId: number): number {
    const market = this.requireMarket(marketId);
    return this.inventories
      .items(market.inventory, playerId)
      .reduce((total, itemId) => {
        const value = total + this.price(marketId, itemId);
        assertGameValue(value);
        return value;
      }, 0);
  }

  netWorth(marketId: string, playerId: number): number {
    const market = this.requireMarket(marketId);
    const value =
      this.resources.get(playerId, market.currency) +
      this.inventoryValue(marketId, playerId);
    assertGameValue(value);
    return value;
  }

  private requireMarket(marketId: string): MarketDefinition {
    const definition = this.definitions.get(marketId);
    if (!definition) throw new GameNotFoundError(`Marché inconnu: ${marketId}`);
    return definition;
  }

  private assertPriceAdjustment(
    price: number,
    delta: number | undefined,
  ): void {
    if (delta !== undefined) {
      assertGameValue(delta);
      assertGameValue(price + delta);
    }
  }
}

export function projectEconomyKitState(
  state: EconomyKitState,
  definitions: readonly MarketDefinition[] = [],
): Record<string, { currency: string; prices: Record<string, number> }> {
  return Object.fromEntries(
    Object.entries(state.prices).map(([marketId, prices]) => [
      marketId,
      {
        currency:
          definitions.find((definition) => definition.id === marketId)
            ?.currency ?? '',
        prices: structuredClone(prices),
      },
    ]),
  );
}
