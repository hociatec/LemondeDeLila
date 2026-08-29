import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Aventure Sauvage declarative game', () => {
  it('assigns unique pawns through generic choices', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(51);
    await game.start();
    await game.choose(1, 'lion');
    await game.choose(2, 'girafe');
    expect(game.state().pending).toBeNull();
    expect(game.state().phase).toBe('playing');
  });

  it('moves deterministically and replays', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(52);
    await game.start();
    await game.choose(1, 'lion');
    await game.choose(2, 'girafe');
    await game.as(1).do('roll', {});
    expect(game.view(1).positions[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });
});
