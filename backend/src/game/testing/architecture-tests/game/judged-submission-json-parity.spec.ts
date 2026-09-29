import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/les-absurdissimes/manifest.json';
import document from '../../../games/vents-dansants/les-absurdissimes/game.json';
import cards from '../../../games/vents-dansants/les-absurdissimes/content/cards.json';

it('keeps judged submissions deterministic through a complete match', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/cards.json': cards,
  });
  const game = await testGame(definition)
    .players(['One', 'Two', 'Three'])
    .seed(42)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 500, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace.length).toBeGreaterThan(100);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '1cea81d791d57ceedf2a5a36edbd0c797520205541524ac4814e2d8e05809cc8',
  );
});
