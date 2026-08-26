import { testGame } from '../../../core/application/public-api';
import { CONTES_DECKS, CONTES_PAWNS, CONTES_TILES } from './content';
import gameDefinition from './game';
import { CONTES_CONTENT_COUNTS } from './rules';

describe('Contes et Cacahuètes declarative game', () => {
  it('preserves the complete content and runs deterministic choices', async () => {
    expect(CONTES_TILES).toHaveLength(60);
    expect(CONTES_PAWNS).toHaveLength(6);
    expect(CONTES_CONTENT_COUNTS.cards).toBe(74);
    expect(CONTES_DECKS.conte).toHaveLength(29);

    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(127);
    await game.start();
    await game.choose(1, CONTES_PAWNS[0].id);
    await game.choose(2, CONTES_PAWNS[1].id);
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    if (game.state().pending?.playerId === actor)
      await game.choose(actor, game.state().pending?.data?.options?.[0]);
    expect('pendingEffect' in game.view(actor)).toBe(false);
    expect(game.replay()).toEqual(game.state());
  });
});
