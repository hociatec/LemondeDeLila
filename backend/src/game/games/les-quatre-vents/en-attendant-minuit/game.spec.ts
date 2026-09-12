import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';

import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('En Attendant Minuit declarative game', () => {
  it('keeps answers private and resolves the Christmas race deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(111);
    await game.start();
    await game.choose(1, 'lutin');
    await game.choose(2, 'renne');
    await game.as(1).do('roll', {});
    expect(game.inspect.deckCount()).toBe(catalogue.cards.length - 1);
    expect('pendingResolution' in game.view(1)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
