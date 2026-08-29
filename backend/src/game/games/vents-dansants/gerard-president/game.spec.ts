import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Gérard président declarative game', () => {
  it('keeps submissions secret until the jury vote', async () => {
    const game = testGame(gameDefinition)
      .players(['Gérard', 'Josette', 'Kevin'])
      .seed(53);
    await game.start();
    await game.as(1).do('set_theme', {});
    const name = game.view(2).hand[0];
    await game.as(2).do('play_name', { names: [name] });
    const kits = (game.view(3) as unknown as { kits: StableGameKitsView }).kits;
    const session = kits.submissions.sessions['gerard.names'];
    expect(session.submittedPlayerIds).toEqual([2]);
    expect(session.valuesByPlayerId).toBeUndefined();
    expect(session.ownValue).toBeUndefined();
  });

  it('replays a deterministic theme draw', async () => {
    const game = testGame(gameDefinition)
      .players(['Gérard', 'Josette', 'Kevin'])
      .seed(54);
    await game.start();
    await game.as(1).do('set_theme', {});
    expect(game.view(1).currentTheme).not.toBeNull();
    expect(await game.replay()).toEqual(game.state());
  });
});
