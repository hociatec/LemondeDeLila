import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Sac à Malices declarative game', () => {
  it('loads a variant and keeps the economic race replayable', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(131);
    await game.start();
    await game.as(1).do('game.configure', { variantId: 'classic' });
    await game.as(1).do('roll', {});
    expect(game.resource(1, 'money')).toBeGreaterThanOrEqual(0);
    expect('pendingPurchase' in game.view(1)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
