import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Jeu de l’Oie declarative game', () => {
  it('selects unique pawns through generic choices then rolls and replays', async () => {
    const game = testGame(gameDefinition).players(['Otis', 'Wallace']).seed(19);
    await game.start();

    while (game.state().pending) {
      const chooser = game.state().pending?.playerId ?? 1;
      await game.choose(chooser, game.state().pending?.data?.options?.[0]);
    }
    const state = game.state() as unknown as {
      engine: {
        kits: {
          pawns?: { assignments: Record<string, Record<string, string[]>> };
        };
      };
    };
    const assignments = Object.values(
      state.engine.kits.pawns?.assignments.goose ?? {},
    ).flat();
    expect(new Set(assignments).size).toBe(2);

    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    expect(game.view(actor).positions[actor]).toBeGreaterThan(1);
    expect(await game.replay()).toEqual(game.state());
  });
});
