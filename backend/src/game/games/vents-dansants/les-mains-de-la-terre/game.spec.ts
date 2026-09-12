import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});
const cards = catalogue.cards;
const byId = Object.fromEntries(cards.map((card) => [card.id, card]));

describe('Les Mains de la Terre declarative game', () => {
  it('deals profession-only hands, keeps them private and replays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(41);
    await game.start();

    expect(game.inspect.hand(1)).toHaveLength(6);
    expect(game.inspect.hand(2)).toHaveLength(6);
    expect(JSON.stringify(game.view(2))).not.toContain(game.inspect.hand(1)[0]);

    const family = byId[game.inspect.hand<string>(1)[0]]?.family;
    const requested = cards.find((card) => card.family === family);
    expect(requested).toBeDefined();
    await game
      .as(1)
      .do('request_card', { cardId: requested!.id, targetPlayerId: 2 });
    expect(await game.replay()).toEqual(game.state());
  });
});
