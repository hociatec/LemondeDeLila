import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe('LAMA declarative game', () => {
  it('keeps hands private and replays a configured round', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('game.configure', {});
    const actor = game.state().turn?.currentPlayerId ?? 1;
    const actions = game.availableActions(actor);
    if (actions.includes('lama_play')) {
      const value = game.view(actor).hand.find((card) => {
        const top = game.view(actor).topCard;
        return (
          top != null && (card === top || card === (top === 7 ? 1 : top + 1))
        );
      });
      if (value != null) await game.as(actor).do('lama_play', { value });
    } else await game.as(actor).do('draw', {});
    expect(game.view(1).hand.length).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });
});
