import {
  createEconomyKitState,
  economy,
  GameEconomyController,
} from './economy-kit';
import {
  createInventoryKitState,
  GameInventoryController,
  inventory,
} from './inventory-kit';
import {
  createPlayerValuesKitState,
  GameResourcesController,
} from './player-values-kit';

function fixture() {
  const state = createEconomyKitState();
  const values = createPlayerValuesKitState();
  const holdings = createInventoryKitState();
  const resources = new GameResourcesController(values, jest.fn());
  const items = new GameInventoryController(holdings, {
    shuffle: (v) => [...v],
  });
  items.create(inventory.set({ id: 'bag', items: ['apple', 'pear'] }), [1]);
  const kit = new GameEconomyController(state, resources, items);
  kit.create(
    economy.market({
      id: 'shop',
      inventory: 'bag',
      currency: 'gold',
      prices: { apple: 2, pear: 3 },
    }),
  );
  return { state, values, holdings, resources, items, kit };
}

it.each(
  [{}, [], { apple: 2 }, { apple: 2, missing: 3 }, { apple: NaN, pear: 3 }].map(
    (prices) => ({ prices }),
  ),
)('rejects malformed or incomplete restored prices %j', ({ prices }) => {
  const { state, kit } = fixture();
  Object.assign(state.prices, { shop: prices });
  expect(() => kit.assertValid()).toThrow();
});

it('rejects unknown restored markets', () => {
  const { state, kit } = fixture();
  state.prices.unknown = { apple: 1 };
  expect(() => kit.assertValid()).toThrow();
});

it('refuses unsafe aggregate inventory values and net worth without modifying assets', () => {
  const { state, values, holdings, resources, items, kit } = fixture();
  kit.setPrice('shop', 'apple', Number.MAX_SAFE_INTEGER);
  items.add('bag', 1, 'apple');
  resources.set(1, 'gold', 1);
  const before = structuredClone({ state, values, holdings });
  expect(() => kit.netWorth('shop', 1)).toThrow();
  expect({ state, values, holdings }).toEqual(before);
  items.add('bag', 1, 'apple');
  expect(() => kit.inventoryValue('shop', 1)).toThrow();
});
