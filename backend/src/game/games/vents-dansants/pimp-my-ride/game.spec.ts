import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import document from './game.json';
import manifest from './manifest.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Pimp My Ride declarative game', () => {
  it('draws a private fourth card and replays the turn', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(59);
    await game.start();

    expect(game.inspect.hand(1)).toHaveLength(4);
    expect(game.inspect.hand(2)).toHaveLength(3);
    expect(JSON.stringify(game.view(2))).not.toContain(game.inspect.hand(1)[0]);

    await game.as(1).do('pass', {});
    expect(game.inspect.hand(2)).toHaveLength(4);
    expect(await game.replay()).toEqual(game.state());
  });
});
