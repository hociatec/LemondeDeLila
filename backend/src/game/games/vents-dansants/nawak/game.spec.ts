import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Nawak declarative game', () => {
  it('supports simultaneous choices/votes without leaking secret selections', async () => {
    const game = testGame(gameDefinition)
      .players(['Alice', 'Bob', 'Charly'])
      .seed(42);
    await game.start();

    await game.as('Alice').do('choose_answer', { answerIndex: 0 });
    const bobKits = (
      game.view('Bob') as unknown as { kits: StableGameKitsView }
    ).kits;
    expect(
      bobKits.submissions.sessions['nawak.answers'].valuesByPlayerId,
    ).toBeUndefined();
    await game.as('Bob').do('choose_answer', { answerIndex: 1 });
    await game.as('Charly').do('choose_answer', { answerIndex: 2 });
    const voteKits = (
      game.view('Alice') as unknown as { kits: StableGameKitsView }
    ).kits;
    expect(voteKits.submissions.stage).toBe('voting');

    await game.as('Alice').do('vote_answer', { targetPlayerId: 2 });
    await game.as('Bob').do('vote_answer', { targetPlayerId: 3 });
    await game.as('Charly').do('vote_answer', { targetPlayerId: 2 });
    const scoredKits = (
      game.view('Alice') as unknown as { kits: StableGameKitsView }
    ).kits;
    expect(scoredKits.score.byPlayer['2']).toBe(2);
    expect(game.state().game.lastRound).not.toBeNull();
    expect(await game.replay()).toEqual(game.state());
  });
});
