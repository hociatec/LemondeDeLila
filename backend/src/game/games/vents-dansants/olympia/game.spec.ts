import { testGame } from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Olympia declarative game', () => {
  it.each([
    'creatures',
    'exploits',
    'actions',
    'attaques',
    'evenements',
  ] as const)(
    'draws from %s into the shared hand and replays',
    async (deck) => {
      const game = await testGame(gameDefinition).players(2).seed(48).start();
      await game.as(1).do('draw_card', { deck });
      expect(game.inspect.hand(1)).toHaveLength(4);
      expect(await game.replay()).toEqual(game.state());
    },
  );
  it('deals private hands and unique divinities', async () => {
    const game = testGame(gameDefinition)
      .players(['AthÃ©na', 'HermÃ¨s'])
      .seed(47);
    await game.start();
    expect(game.inspect.hand(1)).toHaveLength(3);
    expect(game.inspect.hand(2)).toHaveLength(3);
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    const divinities = kits.cards?.hands.divinities.byPlayer;
    expect(divinities?.['1']).not.toEqual(divinities?.['2']);
  });

  it('limits drawing and supports replay', async () => {
    const game = testGame(gameDefinition)
      .players(['AthÃ©na', 'HermÃ¨s'])
      .seed(48);
    await game.start();
    await game.as(1).do('draw_card', { deck: 'heros' });
    expect(game.inspect.hand(1)).toHaveLength(4);
    expect(await game.replay()).toEqual(game.state());
  });
});
