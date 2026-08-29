import { testGame } from '../../../engine/sdk/public-api';
import { LES_MAINS_CARD_BY_ID, LES_MAINS_METIER_CARDS } from './content';
import gameDefinition from './game';

describe('Les Mains de la Terre declarative game', () => {
  it('deals profession-only hands, keeps them private and replays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(41);
    await game.start();

    expect(game.view(1).hand).toHaveLength(6);
    expect(game.view(2).hand).toHaveLength(6);
    expect(JSON.stringify(game.view(2))).not.toContain(game.view(1).hand[0]);

    const family = LES_MAINS_CARD_BY_ID[game.view(1).hand[0]].family;
    const requested = LES_MAINS_METIER_CARDS.find(
      (card) => card.family === family,
    );
    expect(requested).toBeDefined();
    await game
      .as(1)
      .do('request_card', { cardId: requested!.id, targetPlayerId: 2 });
    expect(await game.replay()).toEqual(game.state());
  });
});
