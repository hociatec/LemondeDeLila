import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('La Bande à Banane declarative game', () => {
  it('draws at turn start, keeps hands private and replays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(23);
    await game.start();

    expect(game.view(1).hand).toHaveLength(6);
    expect(game.view(2).hand).toHaveLength(5);
    expect(JSON.stringify(game.view(2))).not.toContain(game.view(1).hand[0]);

    await game.as(1).do('pass', {});

    expect(game.view(2).hand).toHaveLength(6);
    expect(await game.replay()).toEqual(game.state());
  });

  it('enumerates only fully specified legal card plays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(3);
    await game.start();

    const actions = game.availableActions(1);
    expect(actions).toContain('pass');
    expect(
      actions.filter((type) => type === 'play_card').length,
    ).toBeGreaterThan(0);
  });
});
