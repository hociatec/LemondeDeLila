import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Le Marché des Merveilles declarative game', () => {
  it('validates economy actions, persistent protection and replay', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();

    await game.as('Alice').do('buy', { good: 'ingredients' });
    expect(game.state().game.coins[1]).toBe(9);
    expect(game.state().game.inventories[1].ingredients).toBe(1);
    await game.as('Bob').do('protect', {});
    expect(game.state().game.protectedPlayers[2]).toBe(true);
    await game.as('Alice').do('sell', { good: 'ingredients' });
    expect(game.state().game.inventories[1].ingredients).toBe(0);
    expect(game.replay()).toEqual(game.state());
  });
});
