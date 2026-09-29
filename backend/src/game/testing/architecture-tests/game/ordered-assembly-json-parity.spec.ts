import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/pimp-my-ride/manifest.json';
import document from '../../../games/vents-dansants/pimp-my-ride/game.json';
import catalogue from '../../../games/vents-dansants/pimp-my-ride/content/catalogue.json';

it('keeps the ordered assembly simulation deterministic', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': catalogue,
  });
  const game = await testGame(definition)
    .players(['One', 'Two'])
    .seed(23)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 500, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace.length).toBeGreaterThan(100);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '8ee6fd9c0f01bb4eee90137743402608796c5318d401692a29514b42d77bb66f',
  );
});
