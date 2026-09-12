import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import type { GameState } from '../../../core/application/models/game-state.model';

function reorderObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderObjectKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
        .map(([key, item]) => [key, reorderObjectKeys(item)]),
    );
  return value;
}

it.each(
  discoverGameDefinitions().map(
    (definition) => [definition.id, definition] as const,
  ),
)(
  '%s preserves gameplay when persistence reorders object keys',
  async (_id, definition) => {
    const count = Math.max(
      definition.players.min,
      Math.min(3, definition.players.max),
    );
    const game = await testGame(definition)
      .players(
        Array.from({ length: count }, (_, i) => ({
          username: `Bot${i}`,
          isBot: true,
        })),
      )
      .seed(7)
      .start();
    const simulator = new GameSimulator();
    const runtime = new DeclarativeGameRuntime(definition);
    const initial = game.state();
    const original = simulator.run(runtime, initial, { maxCommands: 60 });
    const reordered = simulator.run(runtime, initial, {
      maxCommands: 60,
      stateRoundTrip: (state) => reorderObjectKeys(state) as GameState,
    });
    expect(original.error).toBeUndefined();
    expect(reordered.error).toBeUndefined();
    expect(reordered.events).toEqual(original.events);
    expect(reordered.finalState).toEqual(original.finalState);
  },
);
