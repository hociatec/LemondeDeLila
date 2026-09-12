import { compileJsonGame } from '../../../engine/json/public-api';
import { testGame } from '../../../engine/testing/public-api';
import { rejectRule } from '../../../engine/sdk/public-api';
import document from './game.json';
import manifest from './manifest.json';
import quiz from './quiz.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/quiz.json': quiz,
});

it('resolves answers in participant order even when bots answer in reverse order', async () => {
  const game = await testGame(gameDefinition)
    .players(
      ['one', 'two', 'three'].map((username) => ({ username, isBot: true })),
    )
    .seed(127)
    .start();
  await game.as(-1).do('game.configure', {
    categoryId: 'all',
    targetPoints: 20,
    useTimer: false,
    timerSeconds: 30,
    interQuestionSeconds: 0,
    correctSoloPoints: 2,
    correctMultiPoints: 1,
    wrongPoints: 0,
    timeoutPoints: -1,
  });
  await game.as(-1).do('draw', {});
  for (const id of [-3, -2, -1])
    await game.as(id).do('answer', { answerIndex: 0 });
  const resolved = (await game.events()).find(
    (event) =>
      event.type === 'game.message' && event.data.key === 'game.quiz.resolved',
  );
  const params = resolved?.data.params;
  if (!params || typeof params !== 'object') rejectRule('Missing quiz result');
  const correct =
    'correctPlayerIds' in params && Array.isArray(params.correctPlayerIds)
      ? params.correctPlayerIds
      : [];
  const wrong =
    'wrongPlayerIds' in params && Array.isArray(params.wrongPlayerIds)
      ? params.wrongPlayerIds
      : [];
  expect([...correct, ...wrong]).toEqual([-1, -2, -3]);
  expect(await game.replay()).toEqual(game.state());
});
