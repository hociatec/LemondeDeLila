import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-infinis/arche-de-mnemosyne/manifest.json';
import document from '../../../games/vents-infinis/arche-de-mnemosyne/game.json';
import quiz from '../../../games/vents-infinis/arche-de-mnemosyne/quiz.json';

it('plays a complete deterministic simultaneous quiz', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/quiz.json': quiz,
  });
  const game = await testGame(definition)
    .players(['Anne', 'Bob'])
    .seed(42)
    .start();
  await game.as(1).do('game.configure', {
    categoryId: 'all',
    questionsPerRound: 1,
    targetPoints: 1,
    useTimer: false,
    timerSeconds: 30,
    interQuestionSeconds: 0,
    correctSoloPoints: 2,
    correctMultiPoints: 1,
    wrongPoints: 0,
    timeoutPoints: -1,
  });
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 500, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  expect(result.commands).toBe(12);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(90);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    'a0167ca221c5589a6477048be46506c9c0860debf063ed40f775848f1fbe947b',
  );
});
