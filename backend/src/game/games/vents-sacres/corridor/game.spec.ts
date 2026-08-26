import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('Corridor declarative game', () => {
  it('configures walls and unique pawns with generic choices', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(57);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    expect(game.state().game.setupComplete).toBe(true);
    expect(game.view(1).legalMoves.length).toBeGreaterThan(0);
  });

  it('moves legally and replays deterministically', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(58);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    const move = game.view(1).legalMoves[0];
    await game.as(1).do('corridor_move', move);
    expect(game.replay()).toEqual(game.state());
  });
});
