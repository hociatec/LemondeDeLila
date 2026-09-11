import { testGame } from '../../../engine/testing/public-api';

import gameDefinition from './game';

describe('Zig et Zag declarative game', () => {
  it('captures distinct bonus cards after a tied battle', async () => {
    const game = testGame(gameDefinition).players(['Zig', 'Zag']).seed(0);
    await game.start();
    for (let step = 0; step < 12; step++) {
      const actor = game.availableActions(1).includes('draw_card') ? 1 : 2;
      await game.as(actor).do('draw_card', {});
    }
    const onTable = game
      .state()
      .game.battle.plays.reduce(
        (count, play) => count + play.playedCards.length,
        0,
      );
    expect(
      game.inspect.hand(1).length +
        game.inspect.hand(2).length +
        onTable +
        game.inspect.discardCount(),
    ).toBe(54);
    expect(await game.replay()).toEqual(game.state());
  });

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
