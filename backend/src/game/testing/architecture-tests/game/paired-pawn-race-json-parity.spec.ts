import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/tout-pres-de-maman/manifest.json';
import document from '../../../games/les-quatre-vents/tout-pres-de-maman/game.json';
import catalogue from '../../../games/les-quatre-vents/tout-pres-de-maman/content/catalogue.json';

it('plays a complete deterministic paired-pawn race', async () => {
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
  expect(result.commands).toBe(23);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(233);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '6caf672356896bdcdb661c13b8a05f43bda0d4b68fd180cbfe113c8cf653a555',
  );
});
