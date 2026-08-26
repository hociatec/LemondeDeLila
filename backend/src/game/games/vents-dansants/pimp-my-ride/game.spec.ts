import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Pimp My Ride declarative game', () => {
  it('draws a private fourth card and replays the turn', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(59);
    await game.start();

    expect(game.view(1).hand).toHaveLength(4);
    expect(game.view(2).hand).toHaveLength(3);
    expect(JSON.stringify(game.view(2))).not.toContain(game.view(1).hand[0]);

    await game.as(1).do('pass', {});
    expect(game.view(2).hand).toHaveLength(4);
    expect(game.replay()).toEqual(game.state());
  });
});
