import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-bande-a-banane/manifest.json';
import document from '../../../games/vents-dansants/la-bande-a-banane/game.json';
import catalogue from '../../../games/vents-dansants/la-bande-a-banane/catalogue.json';
it('plays a complete deterministic species-troops match', async () => {
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
  expect(result.commands).toBe(28);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(246);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'b8b650d18caddf38d521c3d407c88ee6c515eaf54397952c7e0293b328008d7b',
  );
});
