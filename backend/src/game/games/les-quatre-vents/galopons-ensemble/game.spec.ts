import { testGame } from '../../../engine/sdk/public-api';
import { GALOPONS_CARDS } from './content';
import gameDefinition from './game';

describe('Galopons ensemble declarative game', () => {
  it('selects unique horses and starts a deterministic apple race', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(101);
    await game.start();
    await game.choose(1, 'shetland');
    await game.choose(2, 'mustang');
    await game.as(1).do('roll', {});
    expect(game.inspect.setupComplete()).toBe(true);
    expect(game.inspect.deckCount()).toBe(GALOPONS_CARDS.length - 1);
    expect(await game.replay()).toEqual(game.state());
  });
});
