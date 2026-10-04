import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Galopons ensemble declarative game', () => {
  it('selects unique horses and starts a deterministic apple race', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(101);
    await game.start();
    await game.choose(1, 'shetland');
    await game.choose(2, 'mustang');
    const state: any = structuredClone(game.state());
    const deck = state.engine.kits.cards.decks.adventure;
    state.engine.kits.cards.decks.adventure = [
      3,
      ...deck.filter((id: number) => id !== 3),
    ];
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const next: any = runtime.applyActions(state, [
      { type: 'roll', payload: {}, meta: { actorId: 1 } },
    ]);
    const resourceEvents = next.engine.pendingEvents.filter(
      (event: any) => event.type === 'resource.changed',
    );
    expect(resourceEvents).not.toHaveLength(0);
    expect(
      resourceEvents.every((event: any) => event.data.announce === false),
    ).toBe(true);
    expect(gameDefinition.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'E', id: 'resources-self' }),
        expect.objectContaining({ key: 'Shift+E', id: 'resources-others' }),
      ]),
    );
    await game.as(1).do('roll', {});
    expect(game.inspect.setupComplete()).toBe(true);
    expect(game.inspect.deckCount()).toBe(catalogue.cards.length - 1);
    expect(await game.replay()).toEqual(game.state());
  });
});
