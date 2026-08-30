import { testGame } from '../../../engine/sdk/public-api';
import { FROUSSE_CARDS } from './content';
import gameDefinition from './game';

describe('Frousse Party declarative game', () => {
  it('runs the haunted race deterministically without leaking pending internals', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(113);
    await game.start();
    await game.choose(1, 'citrouille-rigolote');
    await game.choose(2, 'fantome-peureux');
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    expect(game.inspect.deckCount()).toBe(FROUSSE_CARDS.length - 1);
    expect('pendingSwap' in game.view(actor)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
