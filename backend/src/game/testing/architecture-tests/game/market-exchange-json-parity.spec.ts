import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/le-marche-des-merveilles/manifest.json';
import document from '../../../games/vents-dansants/le-marche-des-merveilles/game.json';
import catalogue from '../../../games/vents-dansants/le-marche-des-merveilles/content/catalogue.json';

it('keeps a complete market exchange match deterministic', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': catalogue,
  });
  const game = await testGame(definition)
    .players(['One', 'Two'])
    .seed(42)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 200, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace.length).toBeGreaterThan(50);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '6d6ad1da991b9efd5e83622e7e40bb64817e5cbaffe88e59721aa0a149853d71',
  );
});
