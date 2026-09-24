import {
  createPlayerValuesKitState,
  GameStatusController,
} from './player-values-kit';
import { assertPlayerValues } from './numeric-invariants';

it('keeps source and stacks isolated and consumes one matching protection at a time', () => {
  const state = createPlayerValuesKitState();
  const statuses = new GameStatusController(state);
  const source = { playerId: 2, effectId: 'ward' };
  const categories = ['negative-movement'];
  statuses.add(1, 'ward', {
    source,
    stacks: 2,
    categories,
    scope: 'until-used',
  });
  source.playerId = 3;
  categories.push('resource-loss');
  expect(statuses.get(1, 'ward')?.source?.playerId).toBe(2);
  expect(statuses.intercept(1, 'resource-loss')).toBe(false);
  expect(statuses.intercept(1, 'negative-movement')).toBe(true);
  expect(statuses.get(1, 'ward')?.stacks).toBe(1);
  expect(statuses.intercept(1, 'negative-movement')).toBe(true);
  expect(statuses.has(1, 'ward')).toBe(false);
});

it('stacks charges independently of expiry and expires on the configured lifecycle', () => {
  const statuses = new GameStatusController(createPlayerValuesKitState());
  statuses.add(1, 'ward', { stacks: 2, scope: 'round', turns: 2 });
  statuses.add(1, 'ward', {
    stacks: 3,
    stacking: 'add',
    scope: 'round',
    turns: 2,
  });
  expect(statuses.get(1, 'ward')?.stacks).toBe(5);
  statuses.tick('turn', 1);
  expect(statuses.get(1, 'ward')?.remaining).toBe(2);
  statuses.tick('round');
  expect(statuses.get(1, 'ward')?.remaining).toBe(1);
  statuses.tick('round');
  expect(statuses.has(1, 'ward')).toBe(false);
});

it.each([0, -1, 1.5, Infinity, NaN])(
  'rejects invalid stack counts %s without mutation',
  (stacks) => {
    const state = createPlayerValuesKitState();
    const before = structuredClone(state);
    expect(() =>
      new GameStatusController(state).add(1, 'ward', { stacks }),
    ).toThrow();
    expect(state).toEqual(before);
  },
);

it.each([
  ['categories', 'movement'],
  ['categories', { movement: true }],
  ['source', null],
  ['source', 'effect'],
  ['source', []],
])('rejects malformed restored status metadata: %s = %j', (field, value) => {
  const state = createPlayerValuesKitState();
  new GameStatusController(state).add(1, 'ward');
  Reflect.set(state.statuses['1'][0], field, value);
  expect(() => assertPlayerValues(state)).toThrow();
});
