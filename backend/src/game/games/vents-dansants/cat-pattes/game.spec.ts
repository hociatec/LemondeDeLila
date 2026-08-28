import { testGame } from '../../../core/application/public-api';
import { CAT_PATTES_CARD_COUNT } from './rules';
import gameDefinition from './game';

describe('Cat Pattes declarative game', () => {
  it('uses a generic configuration choice and private six-card hands', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(71);
    await game.start();
    await game.as(1).do('game.configure', { roundsToPlay: 2 });
    expect(game.view(1).hand).toHaveLength(6);
    expect(game.view(2).hand).toHaveLength(6);
    expect(game.view(1).hand).not.toEqual(game.view(2).hand);
    expect(game.view(1).deckCount + 12).toBe(CAT_PATTES_CARD_COUNT);
  });

  it('draws once, discards, advances and replays exactly', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(72);
    await game.start();
    await game.as(1).do('game.configure', { roundsToPlay: 1 });
    await game.as(1).do('draw', {});
    expect(game.view(1).hand).toHaveLength(7);
    await game.as(1).do('discard_card', { cardId: game.view(1).hand[0] });
    expect(game.view(1).hand).toHaveLength(6);
    expect(game.state().turn?.currentPlayerId).toBe(2);
    expect(await game.replay()).toEqual(game.state());
  });
});
