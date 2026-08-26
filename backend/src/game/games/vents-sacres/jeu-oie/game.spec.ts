import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Jeu de l’Oie declarative game', () => {
  it('selects unique pawns through generic choices then rolls and replays', async () => {
    const game = testGame(gameDefinition).players(['Otis', 'Wallace']).seed(19);
    await game.start();

    while (!game.state().game.setupComplete) {
      const chooser = game.state().pending?.playerId ?? 1;
      await game.choose(chooser, game.state().pending?.data?.options?.[0]);
    }
    const assignments = Object.values(game.state().game.pawnByPlayerId);
    expect(new Set(assignments).size).toBe(2);

    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    expect(game.view(actor).positions[actor]).toBeGreaterThan(1);
    expect(game.replay()).toEqual(game.state());
  });
});
