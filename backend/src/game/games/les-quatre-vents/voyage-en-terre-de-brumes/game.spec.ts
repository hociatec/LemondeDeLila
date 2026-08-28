import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Voyage en Terre de Brumes declarative game', () => {
  it('moves deterministically and supports replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(23);
    await game.start();
    await game.as(1).do('roll', {});
    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.view(1).positions[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('does not expose internal choice state', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(27);
    await game.start();
    expect(JSON.stringify(game.view(1))).not.toContain('pendingChoice');
  });
});
