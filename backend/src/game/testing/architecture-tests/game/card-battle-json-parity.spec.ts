import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/zig-et-zag/manifest.json';
import document from '../../../games/vents-dansants/zig-et-zag/game.json';
import catalogue from '../../../games/vents-dansants/zig-et-zag/catalogue.json';

it('preserves the certified complete successive-tie battle', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': catalogue,
  });
  const game = await testGame(definition)
    .players(['Zig', 'Zag'])
    .seed(42)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 1000, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  expect(result.commands).toBe(74);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(469);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '5cdf1f4070fc17f9a8055341647b1ed589b981545453024ec1f6fae66aa2579e',
  );
});
