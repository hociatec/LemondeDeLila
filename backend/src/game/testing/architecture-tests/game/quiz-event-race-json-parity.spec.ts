import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/mission-galaxie/manifest.json';
import document from '../../../games/les-quatre-vents/mission-galaxie/game.json';
import catalogue from '../../../games/les-quatre-vents/mission-galaxie/catalogue.json';
it('plays a complete deterministic quiz-event race', async () => {
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
  expect(result.commands).toBe(5);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(60);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '7144d55ae6400c53c6eeab55248cfae1542c4048cf85a6113c7863a859a4dfe9',
  );
});
