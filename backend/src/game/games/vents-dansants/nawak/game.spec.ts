import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Nawak declarative game', () => {
  it('supports simultaneous choices/votes without leaking secret selections', async () => {
    const game = testGame(gameDefinition)
      .players(['Alice', 'Bob', 'Charly'])
      .seed(42);
    await game.start();

    await game.as('Alice').do('choose_answer', { answerIndex: 0 });
    expect(game.view('Bob').submissions).toEqual({});
    await game.as('Bob').do('choose_answer', { answerIndex: 1 });
    await game.as('Charly').do('choose_answer', { answerIndex: 2 });
    expect(game.view('Alice').roundStage).toBe('vote');

    await game.as('Alice').do('vote_answer', { targetPlayerId: 2 });
    await game.as('Bob').do('vote_answer', { targetPlayerId: 3 });
    await game.as('Charly').do('vote_answer', { targetPlayerId: 2 });
    expect(game.view('Alice').scores[2]).toBe(2);
    expect(game.state().game.lastRound).not.toBeNull();
    expect(game.replay()).toEqual(game.state());
  });
});
