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

it('returns detached inventory items without changing state on reads', () => {
  const { state, kit } = fixture();
  const before = structuredClone(state);
  kit.items('items', 1).splice(0, 1, 'forged');
  expect(kit.items('items', 3)).toEqual([]);
  expect(state).toEqual(before);
});

it('does not create a destination when an inventory transfer is rejected', () => {
  const { state, kit, emit } = fixture();
  const before = structuredClone(state);
  expect(() => kit.transfer('items', 1, 3, 'pear')).toThrow();
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
});

it.each(['', '__proto__', 'constructor', 'toString'])(
  'rejects unsafe dynamic item %s',
  (itemId) => {
    const state = createInventoryKitState();
    const kit = new GameInventoryController(state, { shuffle: (v) => [...v] });
    kit.create(inventory.set({ id: 'dynamic' }), [1]);
    const before = structuredClone(state);
    expect(() => kit.add('dynamic', 1, itemId)).toThrow();
    expect(state).toEqual(before);
    state.byPlayer.dynamic['1'] = [itemId];
    expect(() => kit.assertValid()).toThrow();
  },
);

it('rejects unregistered restored inventories', () => {
  const { state, kit } = fixture();
  state.byPlayer.unknown = { 1: [] };
  expect(() => kit.assertValid()).toThrow();
});
