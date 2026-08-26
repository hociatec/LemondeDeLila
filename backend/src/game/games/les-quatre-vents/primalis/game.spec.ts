import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Primalis declarative game', () => {
  it('runs deterministic dice, board effects, turns and replay', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();

    for (
      let turn = 0;
      turn < 12 && game.state().status !== 'finished';
      turn += 1
    ) {
      const actorId = game.state().turn?.currentPlayerId ?? 1;
      await game.as(actorId).do('roll', {});
    }

    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.state().log.length).toBeGreaterThan(0);
    expect(game.replay()).toEqual(game.state());
  });
});
