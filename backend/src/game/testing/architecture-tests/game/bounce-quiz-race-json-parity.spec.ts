import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/en-attendant-minuit/manifest.json';
import document from '../../../games/les-quatre-vents/en-attendant-minuit/game.json';
import catalogue from '../../../games/les-quatre-vents/en-attendant-minuit/catalogue.json';
it('plays a complete deterministic bounce-quiz race', async () => {
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
  expect(result.commands).toBe(42);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(357);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '65a763e3660e196d4484bec2558383ad2fbce262bb2ed062e5f039fd6c378186',
  );
});
