import { testGame } from '../../../engine/testing/public-api';

import { compileJsonGame } from '../../../rules/public-api';
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

  it('waits for Space before drawing and announces the resolved effect', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(52);
    await game.start();
    await game.choose(1, 'lion');
    await game.choose(2, 'girafe');
    const actorId = game.state().turn?.currentPlayerId ?? 1;

    await game.as(actorId).do('roll', {});

    expect(game.availableActions(actorId)).toContain('draw_card');
    expect(
      (await game.events()).filter(
        (event) =>
          event.type === 'game.message' && event.data.key === 'game.card.drawn',
      ),
    ).toHaveLength(0);

    await game.as(actorId).do('draw_card', {});
    const draw = (await game.events()).find(
      (event) =>
        event.type === 'game.message' && event.data.key === 'game.card.drawn',
    );
    expect(draw?.data.params).toEqual(
      expect.objectContaining({
        playerId: actorId,
        automatic: false,
        revealed: true,
        cardLabel: expect.any(String),
        effectDescription: expect.any(String),
      }),
    );
    expect(await game.replay()).toEqual(game.state());
  });
});
