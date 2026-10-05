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
  expect(result.commands).toBe(48);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(421);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '4b7612654a176d573a71329f0d6ce4da4753fddebe149fd2240366e6f0877481',
  );
});
