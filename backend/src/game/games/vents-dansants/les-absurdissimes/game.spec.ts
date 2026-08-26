import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Les Absurdissimes declarative game', () => {
  it('keeps answers private until judging and completes a round', async () => {
    const game = testGame(gameDefinition)
      .players(['Judge', 'Alice', 'Bob'])
      .seed(42);
    await game.start();
    expect(game.player('Alice').hand).toHaveLength(10);

    const aliceCard = game.player('Alice').hand[0] as string;
    await game.as('Alice').do('play_card', { cardId: aliceCard });
    expect(game.view('Bob').submissions).toEqual({});
    const bobCard = game.player('Bob').hand[0] as string;
    await game.as('Bob').do('play_card', { cardId: bobCard });

    expect(game.view('Judge').roundStage).toBe('judge');
    expect(Object.keys(game.view('Judge').submissions)).toHaveLength(2);
    await game.as('Judge').do('judge_pick', { winnerId: 2 });
    expect(game.state().game.scores[2]).toBe(1);
    expect(game.state().game.roundStage).toBe('play');
    expect(game.replay()).toEqual(game.state());
  });
});
