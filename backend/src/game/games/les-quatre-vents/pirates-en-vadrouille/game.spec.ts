import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Pirates en vadrouille declarative game', () => {
  it('resolves deterministic movement, landing and replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(9);
    await game.start();

    await game.as(1).do('roll', {});

    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.inspect.positions()[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('never exposes an unresolved effect context', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(11);
    await game.start();

    expect(JSON.stringify(game.view(1))).not.toContain('pendingEffect');
  });
});
