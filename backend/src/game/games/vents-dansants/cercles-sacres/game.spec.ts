import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Cercles Sacrés declarative game', () => {
  it('draws automatically, keeps hands private and replays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(29);
    await game.start();

    expect(game.inspect.hand(1)).toHaveLength(7);
    expect(game.inspect.hand(2)).toHaveLength(6);
    expect(JSON.stringify(game.view(2))).not.toContain(game.inspect.hand(1)[0]);

    await game.as(1).do('pass', {});

    expect(game.inspect.hand(2)).toHaveLength(7);
    expect(await game.replay()).toEqual(game.state());
  });

  it('forces a player above the hand limit to discard', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(31);
    await game.start();
    const hand = game.inspect.hand<string>(1);

    await game.as(1).do('discard_card', { cardId: hand[0] });

    expect(game.inspect.discardCount()).toBe(1);
    game.as(1).expectAction('pass');
  });
});
