import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-sacres/foulees-fantastiques/manifest.json';
import document from '../../../games/vents-sacres/foulees-fantastiques/game.json';
import catalogue from '../../../games/vents-sacres/foulees-fantastiques/catalogue.json';

it('plays a complete deterministic team-pawn race', async () => {
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
    { maxCommands: 2000, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect({
    commands: result.commands,
    length: trace.length,
    hash: createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
  }).toEqual({
    commands: 548,
    length: 2095,
    hash: '4cc75c2a0f8a17e6df6b6f6e52e5214bd57a7ba3e17e4eecb907f377d6b01992',
  });
});
