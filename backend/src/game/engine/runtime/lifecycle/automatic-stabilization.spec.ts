import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import { defineGame } from '../definitions/game-definition';
import { defineAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { when } from '../automation/automatic-kit';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';

it('rejects a nonconvergent automatic rule with a bounded diagnostic trace', () => {
  const definition = defineGame<object>()({
    id: 'automatic-loop',
    displayName: 'Loop',
    category: 'test',
    players: { min: 1, max: 2 },
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
    automatic: [
      when(
        'always',
        () => true,
        () => {},
      ),
    ],
  });
  const runtime = new DeclarativeGameRuntime(definition);
  const state = {
    status: 'started',
    phase: 'playing',
    log: [],
    players: [{ id: 1, username: 'test' }],
  };
  const before = structuredClone(state);
  expect(() => runtime.hydrateInitialState(state)).toThrow(
    GameStateViolationError,
  );
  try {
    runtime.hydrateInitialState(state);
  } catch (error) {
    expect(error).toMatchObject({
      details: { trace: Array(32).fill('automatic:always') },
    });
  }
  expect(state).toEqual(before);
});
