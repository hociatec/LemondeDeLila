import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Zig et Zag declarative game', () => {
  it('reveals one private random card per participant', async () => {
    const game = testGame(gameDefinition).players(['Zig', 'Zag']).seed(41);
    await game.start();
    await game.as(1).do('draw_card', {});
    await game.as(2).do('draw_card', {});
    expect(game.state().game.lastRound).not.toBeNull();
    expect(game.inspect.hand(1).length + game.inspect.hand(2).length).toBe(54);
    expect(await game.replay()).toEqual(game.state());
  });

  it('never exposes another pile or unresolved battle internals', async () => {
    const game = testGame(gameDefinition).players(['Zig', 'Zag']).seed(42);
    await game.start();
    const first = game.view(1);
    expect(game.inspect.hand(1)).not.toEqual(game.inspect.hand(2));
    expect(JSON.stringify(first)).not.toContain('triggerFamilies');
  });
});
