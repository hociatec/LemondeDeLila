import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Foulées Fantastiques declarative game', () => {
  it('uses generic sequential family choices', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(43);
    await game.start();
    await game.choose(1, 'equides');
    await game.choose(2, 'oiseaux');
    expect(game.state().game.setupComplete).toBe(true);
    expect(game.state().phase).toBe('turn');
  });

  it('rolls deterministically without exposing move internals', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(44);
    await game.start();
    await game.choose(1, 'equides');
    await game.choose(2, 'oiseaux');
    await game.as(1).do('roll', {});
    expect(JSON.stringify(game.view(1))).not.toContain('pendingMove');
    expect(game.replay()).toEqual(game.state());
  });
});
