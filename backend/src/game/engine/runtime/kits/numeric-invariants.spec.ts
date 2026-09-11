import {
  createPlayerValuesKitState,
  GameCountersController,
  GameResourcesController,
  GameScoreController,
} from './player-values-kit';
import {
  createInventoryKitState,
  GameInventoryController,
  inventory,
} from './inventory-kit';
import { createDiceKitState, diceKit, GameDiceController } from './dice-kit';
import {
  createMovementKitState,
  GameMovementController,
  movement,
} from './movement-kit';
import type { GameRng } from '../../../core/application/models/game-execution-context.model';
import { assertPlayerValues } from './numeric-invariants';
import {
  createEconomyKitState,
  economy,
  GameEconomyController,
} from './economy-kit';

it('rejects impossible purchases, sales and price adjustments before moving assets', () => {
  const values = createPlayerValuesKitState();
  const holdings = createInventoryKitState();
  const prices = createEconomyKitState();
  const emit = jest.fn();
  const resources = new GameResourcesController(values, emit);
  const items = new GameInventoryController(
    holdings,
    { shuffle: (v) => [...v] },
    emit,
  );
  items.create(inventory.set({ id: 'bag', items: ['apple'] }), [1]);
  const market = new GameEconomyController(prices, resources, items, emit);
  market.create(
    economy.market({
      id: 'shop',
      inventory: 'bag',
      currency: 'gold',
      prices: { apple: 2 },
    }),
  );
  resources.set(1, 'gold', Number.MAX_SAFE_INTEGER);
  items.add('bag', 1, 'apple', 100000);
  const before = structuredClone({ values, holdings, prices });
  emit.mockClear();
  expect(() => market.buy('shop', 1, 'apple')).toThrow();
  expect(() => market.sell('shop', 1, 'apple')).toThrow();
  expect(() => market.sell('shop', 1, 'apple', { priceDelta: NaN })).toThrow();
  expect({ values, holdings, prices }).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
});

it('checks restored values, including signed balances and nonnegative turn counts', () => {
  const state = createPlayerValuesKitState();
  state.resources.gold = { '1': -2.5 };
  state.counters = { debt: -3 };
  expect(() => assertPlayerValues(state)).not.toThrow();
  state.scores['1'] = Number.MAX_SAFE_INTEGER + 1;
  expect(() => assertPlayerValues(state)).toThrow();
  state.scores['1'] = 0;
  state.scheduledSkips['1'] = -1;
  expect(() => assertPlayerValues(state)).toThrow();
});

it('refuses non-finite/unsafe values without changing scores, resources or counters', () => {
  const state = createPlayerValuesKitState();
  const emit = jest.fn();
  const scores = new GameScoreController(state, emit);
  const resources = new GameResourcesController(state, emit);
  const counters = new GameCountersController(state, emit);
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => scores.set(1, value)).toThrow();
    expect(() => resources.set(1, 'gold', value)).toThrow();
    expect(() => counters.set('round', value)).toThrow();
  }
  expect(state).toEqual(createPlayerValuesKitState());
  expect(emit).not.toHaveBeenCalled();
  scores.set(1, -2.5);
  expect(scores.get(1)).toBe(-2.5);
});

it('rejects negative spending and checks destination overflow before transferring', () => {
  const state = createPlayerValuesKitState();
  const resources = new GameResourcesController(state, jest.fn());
  resources.set(1, 'gold', 5);
  resources.set(2, 'gold', Number.MAX_SAFE_INTEGER);
  const before = structuredClone(state);
  expect(() => resources.remove(1, 'gold', -1)).toThrow();
  expect(() => resources.transfer(1, 2, 'gold', 1)).toThrow();
  expect(state).toEqual(before);
  resources.remove(1, 'gold', 0);
  expect(resources.get(1, 'gold')).toBe(5);
});

it('does not create a resource balance on a rejected transfer', () => {
  const state = createPlayerValuesKitState();
  const emit = jest.fn();
  const resources = new GameResourcesController(state, emit);
  expect(() => resources.transfer(1, 2, 'missing', 1)).toThrow('insuffisante');
  expect(state).toEqual(createPlayerValuesKitState());
  expect(emit).not.toHaveBeenCalled();
});

it.each(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', ''])(
  'rejects unsafe resource/counter keys without touching inherited objects: %s',
  (id) => {
    const state = createPlayerValuesKitState();
    const emit = jest.fn();
    const resources = new GameResourcesController(state, emit);
    const counters = new GameCountersController(state, emit);
    const before = Object.getOwnPropertyDescriptor(Object.prototype, '1');
    expect(() => resources.set(1, id, 1)).toThrow();
    expect(() => resources.transfer(1, 2, id, 1)).toThrow();
    expect(() => counters.set(id, 1)).toThrow();
    expect(state).toEqual(createPlayerValuesKitState());
    expect(Object.getOwnPropertyDescriptor(Object.prototype, '1')).toEqual(
      before,
    );
    expect(emit).not.toHaveBeenCalled();
    Object.defineProperty(state.resources, id, {
      value: { 1: 1 },
      enumerable: true,
    });
    expect(() => assertPlayerValues(state)).toThrow();
  },
);

it('orders score ties explicitly by player ID, including signed IDs', () => {
  const state = createPlayerValuesKitState();
  const scores = new GameScoreController(state, jest.fn());
  scores.set(2, 10);
  scores.set(-1, 10);
  scores.set(1, 10);
  expect(scores.ranking()).toEqual([[-1, 1, 2]]);
  expect(scores.ranking('asc')).toEqual([[-1, 1, 2]]);
});

it('bounds inventory counts and leaves the owner inventory intact on rejection', () => {
  const state = createInventoryKitState();
  const items = new GameInventoryController(state, {
    shuffle: (values) => [...values],
  });
  items.create(inventory.set({ id: 'bag', items: ['apple'] }), [1, 2]);
  items.add('bag', 1, 'apple', 2);
  for (const count of [-1, 0.5, NaN, Infinity, 100001]) {
    const before = structuredClone(state);
    expect(() => items.add('bag', 1, 'apple', count)).toThrow();
    expect(() => items.remove('bag', 1, 'apple', count)).toThrow();
    expect(() => items.transfer('bag', 1, 2, 'apple', count)).toThrow();
    expect(state).toEqual(before);
  }
  expect(() => items.remove('bag', 2, 'apple', 1)).toThrow();
});

it('rejects pathological dice workloads before allocating or drawing RNG', () => {
  const state = createDiceKitState();
  const int = jest.fn(() => 0);
  const controller = new GameDiceController(state, {
    int,
  } as unknown as GameRng);
  for (const count of [NaN, Infinity, 0, 1.5, 101])
    expect(() => diceKit({ count, sides: 6 })).toThrow();
  for (const policy of [
    { attempts: Infinity },
    { attempts: 101 },
    { extraDice: NaN },
    { modifier: Infinity },
    { multiplier: Number.MAX_SAFE_INTEGER },
    { reroll: { while: () => true, max: 101 } },
  ])
    expect(() => controller.rollWith('main', policy)).toThrow();
  expect(int).not.toHaveBeenCalled();
  expect(state).toEqual(createDiceKitState());
  expect(controller.roll()).toEqual({ values: [1], total: 1 });
});

it('rejects non-finite and huge movement distances before mutating a track', () => {
  const state = createMovementKitState();
  const controller = new GameMovementController(state);
  controller.createTrack(
    movement.track({ id: 'board', spaces: 10, overshoot: 'wrap' }),
  );
  for (const distance of [NaN, Infinity, 1e12])
    expect(() => controller.move('board', 1, distance)).toThrow();
  expect(state.positions.board).toEqual({});
  expect(controller.move('board', 1, 12)).toBe(2);
});
