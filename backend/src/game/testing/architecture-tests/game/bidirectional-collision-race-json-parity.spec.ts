import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/galopons-ensemble/manifest.json';
import document from '../../../games/les-quatre-vents/galopons-ensemble/game.json';
import catalogue from '../../../games/les-quatre-vents/galopons-ensemble/content/catalogue.json';

it('plays a complete deterministic bidirectional collision race', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': catalogue,
  });
  const game = await testGame(definition)
    .players(['Anne', 'Bob'])
    .seed(42)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 500, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  expect(result.commands).toBe(61);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(555);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'b4b7b69da5fb732d2211a9fe86a23b2c0a9d89894e88660603630eb088184f08',
  );
});
