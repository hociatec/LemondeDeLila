import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-grande-mine-de-barbak/manifest.json';
import document from '../../../games/vents-dansants/la-grande-mine-de-barbak/game.json';
import catalogue from '../../../games/vents-dansants/la-grande-mine-de-barbak/content/catalogue.json';

it('plays a complete deterministic public-domain card game', async () => {
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
  expect(result.commands).toBe(52);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(465);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'fe0f35b0b3e336dcac41b2f252e0fb34166d06ab1c264b081f51e1193a5e6ef5',
  );
});
