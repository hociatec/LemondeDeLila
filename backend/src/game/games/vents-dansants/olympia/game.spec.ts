import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Olympia declarative game', () => {
  it('deals private hands and unique divinities', async () => {
    const game = testGame(gameDefinition)
      .players(['Athéna', 'Hermès'])
      .seed(47);
    await game.start();
    expect(game.view(1).hand).toHaveLength(3);
    expect(game.view(2).hand).toHaveLength(3);
    expect(game.view(1).divinity[1]).not.toBe(game.view(1).divinity[2]);
  });

  it('limits drawing and supports replay', async () => {
    const game = testGame(gameDefinition)
      .players(['Athéna', 'Hermès'])
      .seed(48);
    await game.start();
    await game.as(1).do('draw_card', { deck: 'heros' });
    expect(game.view(1).hand).toHaveLength(4);
    expect(game.replay()).toEqual(game.state());
  });
});
