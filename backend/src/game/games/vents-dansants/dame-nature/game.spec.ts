import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Dame Nature declarative game', () => {
  it('keeps opponents hands private while offering explicit actions', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(31);
    await game.start();
    const hiddenCard = game.view(2).hand[0];
    expect(game.view(1).hand).not.toContain(hiddenCard);
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
