import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Gérard président declarative game', () => {
  it('keeps submissions secret until the jury vote', async () => {
    const game = testGame(gameDefinition)
      .players(['Gérard', 'Josette', 'Kevin'])
      .seed(53);
    await game.start();
    await game.as(1).do('set_theme', {});
    const name = game.view(2).hand[0];
    await game.as(2).do('play_name', { names: [name] });
    expect(JSON.stringify(game.view(3).submissions)).toContain('Prénom secret');
  });

  it('replays a deterministic theme draw', async () => {
    const game = testGame(gameDefinition)
      .players(['Gérard', 'Josette', 'Kevin'])
      .seed(54);
    await game.start();
    await game.as(1).do('set_theme', {});
    expect(game.state().game.currentTheme).not.toBeNull();
    expect(game.replay()).toEqual(game.state());
  });
});
