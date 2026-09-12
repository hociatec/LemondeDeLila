import { compileJsonGame } from '../../../engine/json/public-api';
import { testGame } from '../../../engine/testing/public-api';

import manifest from './manifest.json';
import document from './game.json';
import catalogue from './catalogue.json';

const compile = (source: unknown) =>
  compileJsonGame(manifest, document, {
    'content/catalogue.json': source,
  });
const gameDefinition = compile(catalogue);

describe('Sac stable catalogue references', () => {
  it.each(catalogue.variants.map((variant) => [variant.id, variant] as const))(
    '%s keeps identifiers and economic data independent of labels',
    (variantId, original) => {
      const source = structuredClone(catalogue);
      const variant = source.variants.find(
        (candidate) => candidate.id === variantId,
      )!;
      for (const tile of variant.tiles) {
        tile.title = 'Un autre nom';
        if (tile.group) tile.group = 'Une autre couleur';
      }
      for (const group of variant.groups) {
        group.color = 'Couleur modifiée';
        group.properties = ['Noms modifiés'];
      }
      for (const utility of variant.utilities)
        utility.name = 'Autre équipement';

      expect(
        (compile(source).content.data as { propertyEconomy: unknown })
          .propertyEconomy,
      ).toEqual(source);
      expect(variant.tiles.map((tile) => tile.id)).toEqual(
        original.tiles.map((tile) => tile.id),
      );
      expect(variant.groups.map((group) => group.propertyIds)).toEqual(
        original.groups.map((group) => group.propertyIds),
      );
      expect(variant.utilities.map((utility) => utility.purchasePrice)).toEqual(
        original.utilities.map((utility) => utility.purchasePrice),
      );
    },
  );

  it.each(['tile', 'group', 'utility', 'jail', 'card', 'destination'])(
    'rejects invalid %s references before runtime construction',
    (kind) => {
      const source = structuredClone(catalogue);
      const variant = source.variants[0];
      if (kind === 'tile') variant.tiles[1].id = variant.tiles[0].id;
      if (kind === 'group') variant.groups[0].propertyIds[0] = 'missing';
      if (kind === 'utility') variant.utilities[0].tileId = 'tile-1';
      if (kind === 'jail') variant.rules.jail.tileId = 'tile-1';
      if (kind === 'card') variant.chance[0].id = variant.community[0].id;
      if (kind === 'destination') {
        variant.chance[0].effects = [
          {
            kind: 'custom',
            effectId: 'board-property-economy.movement',
            data: {
              movement: {
                kind: 'tile',
                tileId: 'missing',
                direction: 'forward',
              },
            },
          },
        ];
      }
      expect(() => compile(source)).toThrow();
    },
  );

  it.each(catalogue.variants.map((variant) => variant.id))(
    'replays %s with stable card and ownership identifiers',
    async (variantId) => {
      const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(131);
      await game.start();
      await game.as(1).do('game.configure', { variantId });
      await game.as(1).do('roll', {});
      expect(await game.replay()).toEqual(game.state());
    },
  );
});
