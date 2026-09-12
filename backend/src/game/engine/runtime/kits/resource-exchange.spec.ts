import {
  createPlayerValuesKitState,
  GameResourcesController,
} from './player-values-kit';

const offer = (resource: string, amount = 1) => ({ resource, amount });

it('exchanges distinct resources atomically before emitting either side', () => {
  const state = createPlayerValuesKitState();
  state.resources = { gold: { '1': 3 }, wood: { '2': 4 } };
  const observed: unknown[] = [];
  const resources = new GameResourcesController(state, () =>
    observed.push(structuredClone(state.resources)),
  );
  resources.exchange(1, 2, offer('gold', 2), offer('wood', 3));
  expect(state.resources).toEqual({
    gold: { '1': 1, '2': 2 },
    wood: { '1': 3, '2': 1 },
  });
  expect(observed).toHaveLength(5);
  expect(
    observed.every(
      (snapshot) =>
        JSON.stringify(snapshot) === JSON.stringify(state.resources),
    ),
  ).toBe(true);
});

it.each([
  ['insufficient second offer', offer('gold'), offer('wood', 5)],
  ['invalid first amount', offer('gold', NaN), offer('wood')],
  ['invalid second resource', offer('gold'), offer('__proto__')],
  ['fractional second amount', offer('gold'), offer('wood', 1.5)],
])('rejects %s without mutation or emitted events', (_label, left, right) => {
  const state = createPlayerValuesKitState();
  state.resources = { gold: { '1': 3 }, wood: { '2': 4 } };
  const original = structuredClone(state);
  const emit = jest.fn();
  const resources = new GameResourcesController(state, emit);
  expect(() => resources.exchange(1, 2, left, right)).toThrow();
  expect(state).toEqual(original);
  expect(emit).not.toHaveBeenCalled();
});

it('nets a shared resource before checking magnitudes, preserving exact safe integers', () => {
  const state = createPlayerValuesKitState();
  state.resources = { gold: { '1': 3, '2': Number.MAX_SAFE_INTEGER } };
  const resources = new GameResourcesController(state, jest.fn());
  resources.exchange(1, 2, offer('gold', 3), offer('gold', 3));
  expect(state.resources.gold).toEqual({
    '1': 3,
    '2': Number.MAX_SAFE_INTEGER,
  });
  const original = structuredClone(state);
  expect(() =>
    resources.exchange(1, 2, offer('gold', 3), offer('gold', 1)),
  ).toThrow();
  expect(state).toEqual(original);
});
