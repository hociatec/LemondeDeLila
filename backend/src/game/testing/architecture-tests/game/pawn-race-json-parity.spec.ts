import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from '../../../games/les-quatre-vents/odyssee-quatre-cieux/manifest.json';
import document from '../../../games/les-quatre-vents/odyssee-quatre-cieux/game.json';
import reference from '../../fixtures/odyssee-before-json-parity.json';

it.each(reference)(
  'preserves the complete pawn race for seed $seed',
  async ({ seed, commands, status, events, sha256 }) => {
    const definition = compileJsonGame(manifest, document);
    const game = await testGame(definition)
      .players(['One', 'Two', 'Three'])
      .seed(seed)
      .start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      { maxCommands: commands, startAtMs: 1000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(status);
    const trace = result.events
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(sha256);
  },
);
