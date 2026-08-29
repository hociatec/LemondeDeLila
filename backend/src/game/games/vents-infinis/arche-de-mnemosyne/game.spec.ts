import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';
import { MNEMO_SESSION } from './rules';

describe('Arche de Mnémosyne declarative game', () => {
  it('keeps correctness private and resolves simultaneous answers deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(127);
    await game.start();
    await game.as(1).do('game.configure', {
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
    await game.as(1).do('draw', {});
    await game.as(1).do('answer', { answerIndex: 0 });
    await game.as(2).do('answer', { answerIndex: 1 });
    expect('correctnessByPlayerId' in game.view(1)).toBe(false);
    expect('deadlineMs' in game.view(1)).toBe(false);
    const view = game.view(1) as unknown as {
      kits: { quiz: { sessions: Record<string, { phase: string }> } };
    };
    expect('currentQuestion' in game.view(1)).toBe(false);
    expect(view.kits.quiz.sessions[MNEMO_SESSION]?.phase).toBe('closed');
    expect(await game.replay()).toEqual(game.state());
  });
});
