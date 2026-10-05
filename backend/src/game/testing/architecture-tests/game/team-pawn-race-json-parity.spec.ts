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
  expect(result.commands).toBe(412);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(1469);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '744ce7e25fdbb76bcfcb52bb876a91c723c98e765c1c0da07b3d74b4c283b65e',
  );
});
