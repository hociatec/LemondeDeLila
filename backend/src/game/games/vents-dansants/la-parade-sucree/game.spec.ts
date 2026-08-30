import { testGame } from '../../../engine/sdk/public-api';
import gameDefinition from './game';
import { PARADE_CARD_BY_ID, PARADE_SEQUENCE } from './content';

describe('La Parade Sucrée declarative game', () => {
  it('keeps hands private and runs legal card/pass commands with replay', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();
    const before =
      game.player('Alice').hand.length + game.player('Bob').hand.length;
    expect(before).toBe(13);
    expect(game.inspect.hand('Alice')).not.toEqual(game.inspect.hand('Bob'));

    for (
      let step = 0;
      step < 20 && game.state().status !== 'finished';
      step += 1
    ) {
      const actorId = game.state().turn?.currentPlayerId ?? 1;
      const actions = game.availableActions(actorId);
      const playable = actions.includes('play_card');
      if (playable) {
        const expected = PARADE_SEQUENCE[game.inspect.discardCount()];
        const hand = game.player(actorId).hand as string[];
        const cardId = hand.find(
          (candidate) => PARADE_CARD_BY_ID[candidate]?.value === expected,
        );
        if (cardId) await game.as(actorId).do('play_card', { cardId });
        else await game.as(actorId).do('pass', {});
      } else {
        await game.as(actorId).do('pass', {});
      }
    }

    expect(await game.replay()).toEqual(game.state());
  });
});
