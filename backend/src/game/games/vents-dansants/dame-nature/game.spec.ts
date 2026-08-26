import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Dame Nature declarative game', () => {
  it('keeps opponents hands private while offering explicit actions', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(31);
    await game.start();
    const view = game.state().game;
    const hiddenCard = game.view(2).hand[0];
    expect(game.view(1).hand).not.toContain(hiddenCard);
    expect(view.pollutionTokens).toBe(0);
  });

  it('supports deterministic pass and replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(32);
    await game.start();
    await game.as(1).do('pass', {});
    expect(game.replay()).toEqual(game.state());
  });
});
