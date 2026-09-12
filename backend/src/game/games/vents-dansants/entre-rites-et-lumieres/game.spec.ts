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
const cards = catalogue.cards;
const cardById = Object.fromEntries(cards.map((card) => [card.id, card]));
const familyCards = cards.filter((card) => card.type === 'family');

describe('Entre Rites & Lumières declarative game', () => {
  it('deals family-only private hands and replays a failed request', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(47);
    await game.start();

    expect(game.inspect.hand(1)).toHaveLength(5);
    expect(
      game.inspect
        .hand<string>(1)
        .every((id) => cardById[id].type === 'family'),
    ).toBe(true);
    expect(JSON.stringify(game.view(2))).not.toContain(game.inspect.hand(1)[0]);
    const first = cardById[game.inspect.hand<string>(1)[0]];
    const familyId = first.type === 'family' ? first.familyId : null;
    const card = familyCards.find(
      (candidate) => candidate.familyId === familyId,
    );
    await game.as(1).do('ask_card', { cardId: card!.id, targetPlayerId: 2 });

    expect(await game.replay()).toEqual(game.state());
  });

  it('continues snapshots created before the JSON migration', async () => {
    const game = await testGame(gameDefinition)
      .players(['Alice', 'Bob'])
      .seed(48)
      .start();
    const source = game.state();
    source.engine.contentVersion = 'entre-rites-et-lumieres@content:6b100bc2';
    const restored = new DeclarativeGameRuntime(gameDefinition).applyActions(
      source,
      [],
    );
    expect(restored.engine.contentVersion).toBe('1');
  });
});
