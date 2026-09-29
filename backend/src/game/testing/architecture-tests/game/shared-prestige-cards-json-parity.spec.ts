import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/olympia/manifest.json';
import documentSource from '../../../games/vents-dansants/olympia/game.json';
import catalogue from '../../../games/vents-dansants/olympia/catalogue.json';

it('plays a complete deterministic shared prestige card game', async () => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns.find(
    (candidate) => candidate.kind === 'shared-prestige-cards',
  );
  if (!pattern) throw new Error('Missing shared prestige pattern');
  pattern.targetScore = 3;
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
  expect(result.commands).toBe(3);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(36);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'c874c25ba98c08c4e6a4e7a0454d71abf1f27f2012bb60e0d0dafb0ebb9ee5bf',
  );
});
