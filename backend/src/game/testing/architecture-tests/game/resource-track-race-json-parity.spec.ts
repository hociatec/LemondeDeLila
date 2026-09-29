import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/primalis/manifest.json';
import document from '../../../games/les-quatre-vents/primalis/game.json';
import catalogue from '../../../games/les-quatre-vents/primalis/content/catalogue.json';

it('plays a complete deterministic resource track race', async () => {
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
  expect(result.commands).toBe(15);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(142);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '380363710bd22f6a34447d7f745335afb1e27bbd47408882689613dff8230360',
  );
});
