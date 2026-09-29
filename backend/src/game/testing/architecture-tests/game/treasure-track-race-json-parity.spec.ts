import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/pirates-en-vadrouille/manifest.json';
import documentSource from '../../../games/les-quatre-vents/pirates-en-vadrouille/game.json';
import catalogue from '../../../games/les-quatre-vents/pirates-en-vadrouille/content/catalogue.json';

it('plays and replays a complete deterministic treasure-track race', async () => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns.find(
    (candidate) => candidate.kind === 'treasure-track-race',
  );
  if (pattern?.kind !== 'treasure-track-race')
    throw new Error('missing pattern');
  pattern.requiredGold = 1;
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
    { maxCommands: 300, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  expect(result.commands).toBe(27);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(281);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '599a618d809fc4bc326cd0f64248758990f376d240758eeba53fb23a1be13c4a',
  );
});
