import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Frousse Party declarative game', () => {
  it('announces the sticky-floor card once without a generated technical effect', async () => {
    const game = await testGame(gameDefinition)
      .players(['Alice', 'Bob'])
      .seed(113)
      .start();
    await game.choose(1, 'citrouille-rigolote');
    await game.choose(2, 'fantome-peureux');
    const state: any = game.state();
    const actorId = state.turn.currentPlayerId;
    state.engine.playerValues.statuses[actorId] = [
      {
        id: 'protectedHaunted.next-move-cap',
        remaining: null,
        scope: 'until-used',
        data: { value: 1 },
      },
    ];
    const deck = state.engine.kits.cards.decks.frights;
    state.engine.kits.cards.decks.frights = [
      8,
      ...deck.filter((id: number) => id !== 8),
    ];
    const next = new DeclarativeGameRuntime(gameDefinition).applyActions(
      state,
      [{ type: 'roll', payload: {}, meta: { actorId } }],
    );
    const drawn = next.log.find(
      (entry) => entry.key === 'game.card.drawn' && entry.params.cardId === 8,
    );
    expect(drawn?.params.cardLabel).toBe(
      catalogue.cards.find((c) => c.id === 8)?.text,
    );
    expect(drawn?.params.effectDescription).toBe('');
  });

  it('runs the haunted race deterministically without leaking pending internals', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(113);
    await game.start();
    await game.choose(1, 'citrouille-rigolote');
    await game.choose(2, 'fantome-peureux');
    const actor = game.state().turn?.currentPlayerId ?? 1;
    await game.as(actor).do('roll', {});
    expect(game.inspect.deckCount()).toBe(catalogue.cards.length - 1);
    expect('pendingSwap' in game.view(actor)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });
});
