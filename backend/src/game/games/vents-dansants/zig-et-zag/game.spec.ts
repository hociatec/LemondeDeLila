import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Zig et Zag declarative game', () => {
  it('reveals one private random card per participant', async () => {
    const game = testGame(gameDefinition).players(['Zig', 'Zag']).seed(41);
    await game.start();
    await game.as(1).do('draw_card', {});
    await game.as(2).do('draw_card', {});
    expect(game.state().game.lastRound).not.toBeNull();
    expect(game.view(1).hand.length + game.view(2).hand.length).toBe(54);
    expect(game.replay()).toEqual(game.state());
  });

  it('never exposes another pile or unresolved battle internals', async () => {
    const game = testGame(gameDefinition).players(['Zig', 'Zag']).seed(42);
    await game.start();
    const first = game.view(1);
    const second = game.view(2);
    expect(first.hand).not.toEqual(second.hand);
    expect(JSON.stringify(first)).not.toContain('triggerFamilies');
  });
});
