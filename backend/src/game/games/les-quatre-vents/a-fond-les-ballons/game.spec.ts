import { testGame } from '../../../engine/sdk/public-api';
import { A_FOND_CARD_COUNT } from './rules';
import gameDefinition from './game';

describe('À fond les ballons declarative game', () => {
  it('selects unique pawns then resolves a deterministic roll', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(83);
    await game.start();
    const starter = game.state().pending?.playerId ?? 1;
    await game.choose(starter, 'capitaine-cacahuete');
    const second = starter === 1 ? 2 : 1;
    await game.choose(second, 'professeur-gribouille');
    expect(game.view(1).setupComplete).toBe(true);
    await game.as(starter).do('roll', {});
    expect(game.view(1).lastRoll).toBeGreaterThanOrEqual(1);
    expect(game.view(1).deckCount).toBe(A_FOND_CARD_COUNT - 1);
    expect(await game.replay()).toEqual(game.state());
  });
});
