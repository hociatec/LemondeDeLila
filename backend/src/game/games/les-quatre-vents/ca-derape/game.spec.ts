import { testGame } from '../../../core/application/public-api';
import { CA_DERAPE_CARDS } from './content';
import gameDefinition from './game';

describe('Ça Dérape declarative game', () => {
  it('keeps the 80-card deck and resolves turns deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(91);
    await game.start();
    expect(game.view(1).deckCount).toBe(CA_DERAPE_CARDS.length);
    await game.as(1).do('roll', {});
    expect(game.view(1).lastRollByPlayer[1]).toBeGreaterThanOrEqual(1);
    expect(game.replay()).toEqual(game.state());
  });
});
