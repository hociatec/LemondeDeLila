import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Arche de Mnémosyne declarative game', () => {
  it('keeps correctness private and resolves simultaneous answers deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(127);
    await game.start();
    await game.as(1).do('configure', {
      targetPoints: 20,
      useTimer: false,
      timerSeconds: 30,
      interQuestionSeconds: 0,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    });
    await game.as(1).do('selectCategory', { categoryId: 'all' });
    await game.as(1).do('draw', {});
    await game.as(1).do('answer', { answerIndex: 0 });
    await game.as(2).do('answer', { answerIndex: 1 });
    expect('correctnessByPlayerId' in game.view(1)).toBe(false);
    expect('deadlineMs' in game.view(1)).toBe(false);
    expect(game.state().game.currentQuestion).toBeNull();
    expect(game.replay()).toEqual(game.state());
  });
});
