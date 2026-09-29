import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/frousse-party/manifest.json';
import document from '../../../games/les-quatre-vents/frousse-party/game.json';
import catalogue from '../../../games/les-quatre-vents/frousse-party/content/catalogue.json';
it('plays a complete deterministic protected haunted race', async () => {
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
  expect(result.commands).toBe(37);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(330);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'c7dfb732775d55e97556a5dee7107493ab83148d636d13d5d467ce79d661a67a',
  );
});
