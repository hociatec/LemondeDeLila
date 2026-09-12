import { testGame } from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import document from './game.json';
import manifest from './manifest.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Dame Nature declarative game', () => {
  it('keeps opponents hands private while offering explicit actions', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(31);
    await game.start();
    const hiddenCard = game.inspect.hand(2)[0];
    expect(game.inspect.hand(1)).not.toContain(hiddenCard);
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.counters['dame-nature.pollution']).toBe(0);
  });

  it('supports deterministic pass and replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(32);
    await game.start();
    await game.as(1).do('pass', {});
    expect(await game.replay()).toEqual(game.state());
  });
});
