import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Les Absurdissimes declarative game', () => {
  it('keeps answers private until judging and completes a round', async () => {
    const game = testGame(gameDefinition)
      .players(['Judge', 'Alice', 'Bob'])
      .seed(42);
    await game.start();
    expect(game.player('Alice').hand).toHaveLength(10);

    const aliceCard = game.player('Alice').hand[0] as string;
    await game.as('Alice').do('play_card', { cardId: aliceCard });
    const bobKits = (
      game.view('Bob') as unknown as { kits: StableGameKitsView }
    ).kits;
    const bobSession = bobKits.submissions.sessions['absurdissimes.answers'];
    expect(bobSession.valuesByPlayerId).toBeUndefined();
    expect(bobSession.ownValue).toBeUndefined();
    const bobCard = game.player('Bob').hand[0] as string;
    await game.as('Bob').do('play_card', { cardId: bobCard });

    const judgeView = game.view('Judge');
    const judgeKits = (judgeView as unknown as { kits: StableGameKitsView })
      .kits;
    expect(game.state().phase).toBe('judge');
    expect(
      Object.keys(
        judgeKits.submissions.sessions['absurdissimes.answers']
          .valuesByPlayerId ?? {},
      ),
    ).toHaveLength(2);
    await game.as('Judge').do('judge_pick', { winnerId: 2 });
    const scoredKits = (
      game.view('Judge') as unknown as { kits: StableGameKitsView }
    ).kits;
    expect(scoredKits.score.byPlayer['2']).toBe(1);
    expect(game.state().phase).toBe('play');
    expect(await game.replay()).toEqual(game.state());
  });
});
