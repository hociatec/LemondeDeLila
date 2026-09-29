import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/a-fond-les-ballons/manifest.json';
import document from '../../../games/les-quatre-vents/a-fond-les-ballons/game.json';
import catalogue from '../../../games/les-quatre-vents/a-fond-les-ballons/catalogue.json';

it('plays a complete deterministic chained tile race', async () => {
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
  expect(result.commands).toBe(40);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(366);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '4f4cafe26221a2267e12d7fba14cf01212e0cb2621746b6965416a1455980eff',
  );
});
