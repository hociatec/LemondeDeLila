import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Sac à Malices declarative game', () => {
  it('loads a variant and keeps the economic race replayable', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(131);
    await game.start();
    await game.as(1).do('game.configure', { variantId: 'classic' });
    await game.as(1).do('roll', {});
    expect(game.view(1).money[1]).toBeGreaterThanOrEqual(0);
    expect('pendingPurchase' in game.view(1)).toBe(false);
    expect(game.replay()).toEqual(game.state());
  });
});
