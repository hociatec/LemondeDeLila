import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import document from './game.json';
import manifest from './manifest.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Pirates en vadrouille declarative game', () => {
  it('resolves deterministic movement, landing and replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(9);
    await game.start();

    await game.as(1).do('roll', {});

    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.inspect.positions()[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('never exposes an unresolved effect context', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(11);
    await game.start();

    expect(JSON.stringify(game.view(1))).not.toContain('pendingEffect');
  });
});
