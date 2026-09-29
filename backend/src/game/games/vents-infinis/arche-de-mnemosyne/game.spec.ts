import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import document from './game.json';
import manifest from './manifest.json';
import quiz from './quiz.json';

const definition = compileJsonGame(manifest, document, {
  'content/quiz.json': quiz,
});

describe("L'Arche de Mnémosyne declarative game", () => {
  it('starts a typed quiz round and replays it deterministically', async () => {
    const game = await testGame(definition)
      .players(['Lila', 'Mina'])
      .seed(127)
      .start();

    await game.as(1).do('game.configure', {
      categoryId: 'all',
      questionsPerRound: 5,
      targetPoints: 20,
      useTimer: false,
      timerSeconds: 30,
      interQuestionSeconds: 0,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    });

    expect(game.availableActions(1)).toContain('answer');
    expect(await game.replay()).toEqual(game.state());
  });
});
