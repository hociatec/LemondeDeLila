import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/nawak/manifest.json';
import document from '../../../games/vents-dansants/nawak/game.json';
import catalogue from '../../../games/vents-dansants/nawak/catalogue.json';

it('keeps anonymous choice and voting deterministic through a match', async () => {
  const source = structuredClone(document);
  source.patterns[0].targetScore = 2;
  const definition = compileJsonGame(manifest, source, {
    'content/catalogue.json': catalogue,
  });
  const game = await testGame(definition)
    .players(['One', 'Two', 'Three'])
    .seed(42)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 300, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace.length).toBeGreaterThan(20);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'c52d50811ee40ba32cd36374a1fa1e88f9341b79c3185d942245f4e9e948b049',
  );
});
