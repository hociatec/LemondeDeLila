import { SAC_GAME_CONTENT, SAC_VARIANTS } from './content';
import { parseSacContent } from './content-schema';
import { findTile, groupFor, purchasePrice, nextGroupTile } from './economy';
import { testGame } from '../../../engine/testing/public-api';
import gameDefinition from './game';

describe('Sac stable catalogue references', () => {
  it.each(SAC_VARIANTS.map((variant) => [variant.id, variant] as const))(
    '%s keeps prices, groups and destinations independent of labels',
    (_id, original) => {
      const variant = structuredClone(original);
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
      for (const tile of variant.tiles) {
        expect(purchasePrice(variant, tile)).toBe(
          purchasePrice(original, tile),
        );
        expect(findTile(variant, tile.id)).toBe(tile.n - 1);
        if (tile.type === 'property') {
          expect(purchasePrice(variant, tile)).toBeGreaterThan(0);
          expect(groupFor(variant, tile)?.propertyIds).toContain(tile.id);
        }
      }
      for (const group of variant.groups) {
        const next = nextGroupTile(variant, 0, group.id);
        expect(next).not.toBeNull();
        expect(variant.tiles[next!].groupId).toBe(group.id);
      }
      for (const utility of variant.utilities) {
        const tile = variant.tiles.find(
          (entry) => entry.id === utility.tileId,
        )!;
        expect(tile.type).toBe('utility');
        expect(purchasePrice(variant, tile)).toBe(utility.purchasePrice);
        expect(utility.purchasePrice).toBeGreaterThan(0);
      }
    },
  );

  it.each(['tile', 'group', 'utility', 'jail', 'card', 'destination'])(
    'rejects invalid %s references before runtime construction',
    (kind) => {
      const source = structuredClone(SAC_GAME_CONTENT.data);
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
            effectId: 'sac.movement',
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
      expect(() => parseSacContent(source)).toThrow();
    },
  );

  it.each(SAC_VARIANTS.map((variant) => variant.id))(
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
