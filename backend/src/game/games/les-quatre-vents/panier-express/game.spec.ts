import { testGame } from '../../../core/application/public-api';
import {
  PANIER_EVENTS,
  PANIER_EXCHANGES,
  PANIER_PAWNS,
  PANIER_QUIZZES,
  PANIER_TILES,
} from './content';
import gameDefinition from './game';

describe('Panier Express declarative game', () => {
  it('preserves every card and keeps private shopping data private', async () => {
    expect(PANIER_TILES).toHaveLength(40);
    expect(PANIER_EVENTS).toHaveLength(40);
    expect(PANIER_EXCHANGES).toHaveLength(18);
    expect(PANIER_QUIZZES).toHaveLength(30);

    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(131);
    await game.start();
    await game.choose(1, PANIER_PAWNS[0].id);
    await game.choose(2, PANIER_PAWNS[1].id);
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    expect('shoppingLists' in game.view(actor)).toBe(false);
    expect('inventories' in game.view(actor)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
