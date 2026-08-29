import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Odyssée des Quatre Cieux declarative game', () => {
  it('runs dice, choices, turns and replay through engine primitives', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();

    for (let step = 0; step < 40; step += 1) {
      const state = game.state();
      const actorId =
        state.pending?.playerId ?? state.turn?.currentPlayerId ?? 1;
      if (state.pending) {
        const options = state.pending.data?.options;
        const value = Array.isArray(options) ? options[0] : null;
        await game
          .as(actorId)
          .do('choice.resolve' as never, { value } as never);
      } else {
        await game.as(actorId).do('roll', {});
      }
      const kits = (
        game.view(actorId) as unknown as { kits: StableGameKitsView }
      ).kits;
      const moved = Object.values(
        kits.pawns?.sets.odyssee.positions ?? {},
      ).some((position) => position >= 0);
      if (moved) break;
    }

    expect(
      Object.values(
        (game.view(1) as unknown as { kits: StableGameKitsView }).kits.pawns
          ?.sets.odyssee.positions ?? {},
      ).some((position) => position >= 0),
    ).toBe(true);
    expect(
      game.state().log.some((entry) => entry.key === 'game.dice.rolled'),
    ).toBe(true);
    expect(await game.replay()).toEqual(game.state());
  });
});
