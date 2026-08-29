import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Corridor declarative game', () => {
  it('configures walls and unique pawns with generic choices', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(57);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    expect(game.view(1).setupComplete).toBe(true);
    expect(game.availableActions(1)).toContain('corridor_move');
  });

  it('moves legally and replays deterministically', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(58);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    await game.as(1).do('corridor_move', { x: 4, y: 1 });
    expect(await game.replay()).toEqual(game.state());
  });
});
