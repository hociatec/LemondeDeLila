import {
  testGame,
  type StableGameSystemView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Foulées Fantastiques declarative game', () => {
  it('uses generic sequential family choices', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(43);
    await game.start();
    await game.choose(1, 'equides');
    await game.choose(2, 'oiseaux');
    const system = (game.view(1) as unknown as { system: StableGameSystemView })
      .system;
    expect(system.setup.complete).toBe(true);
    expect(game.state().phase).toBe('turn');
  });

  it('rolls deterministically without exposing move internals', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(44);
    await game.start();
    await game.choose(1, 'equides');
    await game.choose(2, 'oiseaux');
    await game.as(1).do('roll', {});
    expect(JSON.stringify(game.view(1))).not.toContain('pendingMove');
    expect(await game.replay()).toEqual(game.state());
  });
});
