import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Mission Galaxie declarative game', () => {
  it('resolves a deterministic launch and replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(37);
    await game.start();
    await game.as(1).do('roll', {});
    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.view(1).positions[1]).toBeGreaterThan(0);
    expect(game.replay()).toEqual(game.state());
  });

  it('does not expose pending resolution internals', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(38);
    await game.start();
    expect(JSON.stringify(game.view(1))).not.toContain('pendingChoice');
  });
});
