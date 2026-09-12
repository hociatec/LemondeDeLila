import { compileJsonGame } from '../../../engine/json/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import catalogue from './content/catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Contes et Cacahuètes declarative game', () => {
  it('preserves the complete content and runs deterministic choices', async () => {
    expect(catalogue.tiles).toHaveLength(60);
    expect(catalogue.pawns).toHaveLength(6);
    expect(
      Object.values(catalogue.decks).reduce(
        (total, cards) => total + cards.length,
        0,
      ),
    ).toBe(74);
    expect(catalogue.decks.conte).toHaveLength(29);

    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(127);
    await game.start();
    await game.choose(1, catalogue.pawns[0].id);
    await game.choose(2, catalogue.pawns[1].id);
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    if (game.state().pending?.playerId === actor)
      await game.choose(actor, game.state().pending?.data?.options?.[0]);
    expect('pendingEffect' in game.view(actor)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });

  it('continues a snapshot created with the TypeScript content version', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(128);
    await game.start();
    await game.choose(1, catalogue.pawns[0].id);
    await game.choose(2, catalogue.pawns[1].id);
    const legacy = game.state();
    legacy.engine!.contentVersion =
      'contes-et-cacahuetes@content:32cd4133';
    const actorId = legacy.turn!.currentPlayerId!;

    const restored = new DeclarativeGameRuntime(gameDefinition).applyActions(
      legacy,
      [{ type: 'roll', payload: {}, meta: { actorId } }],
    );

    expect(restored.engine?.contentVersion).toBe('1');
    expect(restored.engine?.kits?.dice).toBeDefined();
  });
});
