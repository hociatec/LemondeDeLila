import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('La Grande Mine de Barbak declarative game', () => {
  it('draws automatically, keeps hands private and replays', async () => {
    const game = testGame(gameDefinition).players(['Borin', 'Dwalin']).seed(53);
    await game.start();

    expect(game.view(1).hand.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(game.view(2))).not.toContain(game.view(1).hand[0]);
    expect(game.availableActions(1)).toContain('pass');
    if (game.state().status !== 'finished') await game.as(1).do('pass', {});
    expect(await game.replay()).toEqual(game.state());
  });
});
