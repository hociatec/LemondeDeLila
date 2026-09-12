import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Frousse Party declarative game', () => {
  it('runs the haunted race deterministically without leaking pending internals', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(113);
    await game.start();
    await game.choose(1, 'citrouille-rigolote');
    await game.choose(2, 'fantome-peureux');
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    expect(game.inspect.deckCount()).toBe(catalogue.cards.length - 1);
    expect('pendingSwap' in game.view(actor)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
