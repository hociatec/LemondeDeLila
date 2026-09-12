import { defineGame } from '../definitions/game-definition';
import { defineAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import type { DeclarativeState } from './declarative-state';

it('isolates a reused setup result from its author and from every other match', () => {
  const initial = { counter: 0, nested: { values: [1, 2] } };
  const definition = defineGame<typeof initial>()({
    id: 'setup-isolation',
    displayName: 'Isolation',
    category: 'test',
    players: { min: 1, max: 2 },
    setup: () => initial,
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
  });
  const runtime = new DeclarativeGameRuntime(definition);
  const base = {
    status: 'started',
    phase: 'playing',
    log: [],
    players: [{ id: 1, username: 'One' }],
  };
  const first = runtime.hydrateInitialState(base) as DeclarativeState<
    typeof initial
  >;
  const second = runtime.hydrateInitialState(base) as DeclarativeState<
    typeof initial
  >;
  first.game.counter = 9;
  first.game.nested.values.push(3);
  expect(second.game).toEqual({ counter: 0, nested: { values: [1, 2] } });
  expect(initial).toEqual({ counter: 0, nested: { values: [1, 2] } });
  initial.nested.values.push(4);
  expect(second.game.nested.values).toEqual([1, 2]);
});
