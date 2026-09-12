import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Galopons ensemble declarative game', () => {
  it('selects unique horses and starts a deterministic apple race', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(101);
    await game.start();
    await game.choose(1, 'shetland');
    await game.choose(2, 'mustang');
    await game.as(1).do('roll', {});
    expect(game.inspect.setupComplete()).toBe(true);
    expect(game.inspect.deckCount()).toBe(catalogue.cards.length - 1);
    expect(await game.replay()).toEqual(game.state());
  });
});
