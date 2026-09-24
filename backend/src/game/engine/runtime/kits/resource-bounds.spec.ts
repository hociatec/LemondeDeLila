import { createPlayerValuesKitState } from './player-values-kit';
import { GameResourcesController } from './resource-controller';
import { resources } from './resource-definition';

function fixture() {
  const definition = resources.pool({
    id: 'energy',
    initial: 4,
    min: 2,
    max: 6,
  });
  const state = createPlayerValuesKitState();
  const emit = jest.fn();
  const controller = new GameResourcesController(state, emit, [definition]);
  controller.initialize(definition, [1, 2]);
  emit.mockClear();
  return { state, emit, controller, definition };
}

it('uses a single canonical balance and excludes the minimum from affordability', () => {
  const { controller, state } = fixture();
  expect(state.resources.energy).toEqual({ 1: 4, 2: 4 });
  expect(controller.has(1, 'energy', 2)).toBe(true);
  expect(controller.has(1, 'energy', 3)).toBe(false);
  expect(controller.settle(1, 'energy', 3, 'partial')).toMatchObject({
    paid: 2,
    shortfall: 1,
    balance: 2,
  });
});

it('rejects changes, transfers and exchanges atomically at either bound', () => {
  const { controller, state, emit } = fixture();
  const before = structuredClone(state);
  for (const operation of [
    () => controller.add(1, 'energy', 3),
    () => controller.remove(1, 'energy', 3),
    () => controller.transfer(1, 2, 'energy', 3),
    () =>
      controller.exchange(
        1,
        2,
        { resource: 'energy', amount: 4 },
        { resource: 'energy', amount: 1 },
      ),
  ]) {
    expect(operation).toThrow();
    expect(state).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
  }
});

it('restores bounds from the immutable definition, independently of saved balances', () => {
  const { controller, state, definition } = fixture();
  controller.remove(1, 'energy', 2);
  const restored = new GameResourcesController(
    structuredClone(state),
    jest.fn(),
    [definition],
  );
  expect(restored.has(1, 'energy', 1)).toBe(false);
  expect(() => restored.add(2, 'energy', 3)).toThrow();
});

it.each([
  { id: 'energy', min: 3, max: 1 },
  { id: 'energy', initial: 11, max: 10 },
  { id: 'energy', min: NaN },
])('rejects invalid definitions %j', (definition) => {
  expect(() => resources.pool(definition)).toThrow();
});

it('validates every participant before initialization and detaches static bounds', () => {
  const state = createPlayerValuesKitState();
  const emit = jest.fn();
  const controller = new GameResourcesController(state, emit);
  const definition = {
    component: 'resource.pool' as const,
    id: 'energy',
    initial: 4,
    max: 6,
  };
  expect(() => controller.initialize(definition, [1, 0])).toThrow();
  expect(state.resources).toEqual({});
  expect(emit).not.toHaveBeenCalled();
  controller.initialize(definition, [1]);
  definition.max = 100;
  expect(() => controller.add(1, 'energy', 3)).toThrow();
  expect(controller.get(1, 'energy')).toBe(4);
});
