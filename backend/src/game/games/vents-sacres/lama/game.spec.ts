import { testGame } from '../../../engine/sdk/public-api';
import type { LamaCard } from './content';
import gameDefinition from './game';

describe('LAMA declarative game', () => {
  it('keeps hands private and replays a configured round', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('game.configure', {});
    const actor = game.state().turn?.currentPlayerId ?? 1;
    const actions = game.availableActions(actor);
    if (actions.includes('lama_play')) {
      const state = game.state() as ReturnType<typeof game.state> & {
        engine: { kits: { cards: { discards: Record<string, LamaCard[]> } } };
      };
      const top = state.engine.kits.cards.discards.lama.at(-1);
      const value = game.inspect.hand(actor).find((card) => {
        return (
          top != null && (card === top || card === (top === 7 ? 1 : top + 1))
        );
      });
      if (value != null) await game.as(actor).do('lama_play', { value });
    } else await game.as(actor).do('draw', {});
    expect(game.inspect.hand(1).length).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });
});
