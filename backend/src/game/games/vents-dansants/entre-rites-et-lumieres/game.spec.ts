import { testGame } from '../../../engine/sdk/public-api';
import { ENTRE_RITES_CARD_BY_ID, ENTRE_RITES_FAMILY_CARDS } from './content';
import gameDefinition from './game';

describe('Entre Rites & Lumières declarative game', () => {
  it('deals family-only private hands and replays a failed request', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(47);
    await game.start();

    expect(game.view(1).hand).toHaveLength(5);
    expect(
      game
        .view(1)
        .hand.every((id) => ENTRE_RITES_CARD_BY_ID[id].type === 'family'),
    ).toBe(true);
    expect(JSON.stringify(game.view(2))).not.toContain(game.view(1).hand[0]);
    const first = ENTRE_RITES_CARD_BY_ID[game.view(1).hand[0]];
    const familyId = first.type === 'family' ? first.familyId : null;
    const card = ENTRE_RITES_FAMILY_CARDS.find(
      (candidate) => candidate.familyId === familyId,
    );
    await game.as(1).do('ask_card', { cardId: card!.id, targetPlayerId: 2 });

    expect(await game.replay()).toEqual(game.state());
  });
});
