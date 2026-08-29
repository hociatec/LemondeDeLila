import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import { CA_DERAPE_CARDS } from './content';
import gameDefinition from './game';

describe('Ça Dérape declarative game', () => {
  it('keeps the 80-card deck and resolves turns deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(91);
    await game.start();
    expect(game.view(1).deckCount).toBe(CA_DERAPE_CARDS.length);
    await game.as(1).do('roll', {});
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.resources['ca-derape.last-roll']['1']).toBeGreaterThanOrEqual(
      1,
    );
    expect(kits.dice?.byPlayer['1']?.main.total).toBeGreaterThanOrEqual(1);
    expect(await game.replay()).toEqual(game.state());
  });
});
