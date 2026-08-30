import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Olympia declarative game', () => {
  it('deals private hands and unique divinities', async () => {
    const game = testGame(gameDefinition)
      .players(['Athéna', 'Hermès'])
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
      .players(['Athéna', 'Hermès'])
      .seed(48);
    await game.start();
    await game.as(1).do('draw_card', { deck: 'heros' });
    expect(game.inspect.hand(1)).toHaveLength(4);
    expect(await game.replay()).toEqual(game.state());
  });
});
