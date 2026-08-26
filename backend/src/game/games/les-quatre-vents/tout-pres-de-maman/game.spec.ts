import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Tout près de Maman declarative game', () => {
  it('chains deterministic tile effects and replays exactly', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mouche']).seed(13);
    await game.start();

    await game.as(1).do('roll', {});

    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.view(1).positions[1]).toBeGreaterThanOrEqual(0);
    expect(game.replay()).toEqual(game.state());
  });

  it('does not expose the internal continuation of a choice', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mouche']).seed(2);
    await game.start();

    expect(JSON.stringify(game.view(1))).not.toContain('pendingChoice');
  });
});
