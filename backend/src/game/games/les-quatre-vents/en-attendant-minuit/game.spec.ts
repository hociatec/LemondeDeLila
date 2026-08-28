import { testGame } from '../../../core/application/public-api';
import { MINUIT_CARDS } from './content';
import gameDefinition from './game';

describe('En Attendant Minuit declarative game', () => {
  it('keeps answers private and resolves the Christmas race deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(111);
    await game.start();
    await game.choose(1, 'lutin');
    await game.choose(2, 'renne');
    await game.as(1).do('roll', {});
    expect(game.view(1).deckCount).toBe(MINUIT_CARDS.length - 1);
    expect('pendingResolution' in game.view(1)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
