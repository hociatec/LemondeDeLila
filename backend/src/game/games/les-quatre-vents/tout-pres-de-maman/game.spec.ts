import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Tout près de Maman declarative game', () => {
  it('chains deterministic tile effects and replays exactly', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mouche']).seed(13);
    await game.start();

    await game.as(1).do('roll', {});

    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.dice?.total).toBeGreaterThanOrEqual(1);
    expect(game.view(1).positions[1]).toBeGreaterThanOrEqual(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('does not expose the internal continuation of a choice', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mouche']).seed(2);
    await game.start();

    expect(JSON.stringify(game.view(1))).not.toContain('pendingChoice');
  });
});
