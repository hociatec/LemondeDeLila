import { legacyExtensionFixture } from '../../../engine/testing/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';

import catalogue from './catalogue.json';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';
const document = legacyExtensionFixture(
  documentExtensionSource,
  'speciesTroops',
);

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('La Bande à Banane declarative game', () => {
  it('uses arbitrary collection kinds and executable effects instead of card names', async () => {
    const source = structuredClone(document);
    const content = structuredClone(catalogue);
    const kinds = new Map(
      source.speciesTroops.species.map((id, index) => [
        id,
        'component-' + index,
      ]),
    );
    source.speciesTroops.species = [...kinds.values()];
    for (const card of content.cards) {
      if (card.species) card.species = kinds.get(card.species)!;
      if (card.action) card.action = 'unrelated-action';
      if (card.trap) card.trap = 'unrelated-trap';
    }
    const definition = compileJsonGame(manifest, source, {
      'content/catalogue.json': content,
    });
    const original = testGame(gameDefinition).players(2).seed(3);
    const alternative = testGame(definition).players(2).seed(3);
    await original.start();
    await alternative.start();
    expect(alternative.availableActions(1)).toEqual(
      original.availableActions(1),
    );
    const originalState: any = original.state();
    const alternativeState: any = alternative.state();
    const cardIds = content.cards.map((card) => card.id);
    originalState.engine.kits.cards.hands.players['1'] = cardIds;
    alternativeState.engine.kits.cards.hands.players['1'] = cardIds;
    const originalRuntime = new DeclarativeGameRuntime(gameDefinition);
    const normalize = (
      actions: ReturnType<typeof originalRuntime.getAvailableActions>,
    ) =>
      actions.map((action) => ({
        ...action,
        payload:
          typeof action.payload?.species === 'string'
            ? {
                ...action.payload,
                species:
                  kinds.get(action.payload.species) ?? action.payload.species,
              }
            : action.payload,
      }));
    expect(
      normalize(
        new DeclarativeGameRuntime(definition).getAvailableActions(
          alternativeState,
          1,
        ),
      ),
    ).toEqual(normalize(originalRuntime.getAvailableActions(originalState, 1)));
    await alternative.as(1).do('pass', {});
    expect(await alternative.replay()).toEqual(alternative.state());
    source.speciesTroops.species = ['unknown'];
    expect(() =>
      compileJsonGame(manifest, source, { 'content/catalogue.json': content }),
    ).toThrow();
  });
  it('draws at turn start, keeps hands private and replays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(23);
    await game.start();

    expect(game.inspect.hand(1)).toHaveLength(6);
    expect(game.inspect.hand(2)).toHaveLength(5);
    expect(JSON.stringify(game.view(2))).not.toContain(game.inspect.hand(1)[0]);

    await game.as(1).do('pass', {});

    expect(game.inspect.hand(2)).toHaveLength(6);
    expect(await game.replay()).toEqual(game.state());
  });

  it('enumerates only fully specified legal card plays', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(3);
    await game.start();

    const actions = game.availableActions(1);
    expect(actions).toContain('pass');
    expect(
      actions.filter((type) => type === 'play_card').length,
    ).toBeGreaterThan(0);
  });
});
