import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import { createTestGameState } from '../../../core/testing/game-test-state';
import { GameCorruptedStateError } from '../../../core/domain/errors/game-runtime.errors';

it.each(['zig-et-zag', 'nawak'])(
  '%s identifies a corrupted pack state before projecting it',
  (id) => {
    const definition = discoverGameDefinitions().find((game) => game.id === id);
    if (!definition) throw new Error(`Missing definition ${id}`);
    const runtime = new DeclarativeGameRuntime(definition);
    const state = runtime.hydrateInitialState(
      createTestGameState({
        definition,
        players: Array.from(
          { length: definition.players.min },
          (_, index) => `Player ${index}`,
        ),
        seed: 42,
        startedAt: '2026-09-23T10:00:00.000Z',
      }),
    );
    Reflect.set(state, 'game', {});
    expect(() => runtime.exposeStateForUser(state, 1)).toThrow(
      GameCorruptedStateError,
    );
  },
);
