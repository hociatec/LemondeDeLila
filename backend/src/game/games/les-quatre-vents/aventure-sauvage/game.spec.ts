import { testGame } from '../../../engine/testing/public-api';

import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import board from './content/board.json';
import cards from './content/cards.json';
import pawns from './content/pawns.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
});

describe('Aventure Sauvage declarative game', () => {
  it('assigns unique pawns through generic choices', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(51);
    await game.start();
    await game.choose(1, 'lion');
    await game.choose(2, 'girafe');
    expect(game.state().pending).toBeNull();
    expect(game.state().phase).toBe('playing');
  });

  it('moves deterministically and replays', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(52);
    await game.start();
    await game.choose(1, 'lion');
    await game.choose(2, 'girafe');
    await game.as(1).do('roll', {});
    expect(game.inspect.positions()[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });
});
