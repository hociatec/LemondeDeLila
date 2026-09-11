import {
  createInventoryKitState,
  GameInventoryController,
  inventory,
} from './inventory-kit';

function fixture() {
  const state = createInventoryKitState();
  const emit = jest.fn();
  const kit = new GameInventoryController(
    state,
    { shuffle: (values) => [...values] },
    emit,
  );
  kit.create(inventory.set({ id: 'items', items: ['apple', 'pear'] }), [1, 2]);
  kit.add('items', 1, 'apple');
  kit.add('items', 2, 'pear');
  emit.mockClear();
  return { state, kit, emit };
}

it('does not partially consume an item exchanged with itself', () => {
  const { state, kit, emit } = fixture();
  const before = structuredClone(state);
  kit.exchange('items', 1, 'apple', 1, 'apple');
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
});

it('checks both possessions before removing either item', () => {
  const { state, kit, emit } = fixture();
  const before = structuredClone(state);
  expect(() => kit.exchange('items', 1, 'apple', 2, 'apple')).toThrow();
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
  kit.exchange('items', 1, 'apple', 2, 'pear');
  expect(kit.items('items', 1)).toEqual(['pear']);
  expect(kit.items('items', 2)).toEqual(['apple']);
});

it('rejects swapping an unknown inventory before modifying state', () => {
  const { state, kit, emit } = fixture();
  const before = structuredClone(state);
  expect(() => kit.swap('unknown', 1, 2)).toThrow();
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
});
