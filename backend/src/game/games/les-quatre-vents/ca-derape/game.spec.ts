import { testGame } from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Ça Dérape declarative game', () => {
  it('keeps the 80-card deck and resolves turns deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(91);
    await game.start();
    expect(game.inspect.deckCount()).toBe(catalogue.cards.length);
    await game.as(1).do('roll', {});
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.resources['race-hazard.last-roll']['1']).toBeGreaterThanOrEqual(
      1,
    );
    expect(kits.dice?.byPlayer['1']?.main.total).toBeGreaterThanOrEqual(1);
    expect(await game.replay()).toEqual(game.state());
  });
});
