import { compileJsonGame } from '../../../engine/json/public-api';
import { testGame } from '../../../engine/testing/public-api';
import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Voyage en Terre de Brumes declarative game', () => {
  it('moves deterministically and supports replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(23);
    await game.start();
    await game.as(1).do('roll', {});
    expect(game.inspect.lastRoll()).not.toBeNull();
    expect(game.inspect.positions()[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('does not expose internal choice state', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(27);
    await game.start();
    expect(JSON.stringify(game.view(1))).not.toContain('pendingChoice');
  });
});
