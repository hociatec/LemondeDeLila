import { compileJsonGame } from '../../../engine/json/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import document from './game.json';
import manifest from './manifest.json';
import catPattes from './content/cat-pattes.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/cat-pattes.json': catPattes,
});
describe('Cat Pattes declarative game', () => {
  it('uses a generic configuration choice and private six-card hands', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(71);
    await game.start();
    await game.as(1).do('game.configure', { roundsToPlay: 2 });
    expect(game.inspect.hand(1)).toHaveLength(6);
    expect(game.inspect.hand(2)).toHaveLength(6);
    expect(game.inspect.hand(1)).not.toEqual(game.inspect.hand(2));
    expect(game.inspect.deckCount() + 12).toBe(catPattes.cards.length);
  });

  it('draws once, discards and replays exactly', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(72);
    await game.start();
    await game.as(1).do('game.configure', { roundsToPlay: 1 });
    await game.as(1).do('draw', {});
    expect(game.inspect.hand(1)).toHaveLength(7);
    await game.as(1).do('discard_card', {
      cardId: game.inspect.hand<string>(1)[0],
    });
    expect(game.inspect.hand(1)).toHaveLength(6);
    expect(game.state().turn?.currentPlayerId).toBe(2);
    expect(await game.replay()).toEqual(game.state());
  });

  it('continues a snapshot created with the TypeScript content version', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(73);
    await game.start();
    await game.as(1).do('game.configure', { roundsToPlay: 2 });
    const legacy = game.state() as ReturnType<typeof game.state> & {
      engine: {
        contentVersion: string;
        kits?: {
          cards?: { hands?: Record<string, Record<string, unknown[]>> };
        };
      };
    };
    legacy.engine!.contentVersion = 'cat-pattes@content:b15666ae';
    const actorId = legacy.turn!.currentPlayerId!;

    const restored = new DeclarativeGameRuntime(gameDefinition).applyActions(
      legacy,
      [{ type: 'draw', payload: {}, meta: { actorId } }],
    ) as typeof legacy;

    expect(restored.engine?.contentVersion).toBe('2');
    const cards = restored.engine.kits?.cards;
    expect(cards?.hands?.players?.[String(actorId)]).toHaveLength(7);
  });
});
