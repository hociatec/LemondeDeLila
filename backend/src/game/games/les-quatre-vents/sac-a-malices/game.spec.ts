import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';

import manifest from './manifest.json';
import document from './game.json';
import catalogue from './catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const gameDefinition = compileJsonGame(manifest, document, assets);

describe('Sac structured cards', () => {
  it.each(catalogue.variants.map((variant) => [variant.id, variant] as const))(
    'validates every deck and tax in %s independently of narrative text',
    (_id, variant) => {
      const edited = structuredClone(catalogue);
      const editedVariant = edited.variants.find(
        (candidate) => candidate.id === variant.id,
      )!;
      for (const card of [...editedVariant.chance, ...editedVariant.community])
        card.text = 'Payez 99999 puis avancez de 999 cases';
      const compiled = compileJsonGame(manifest, document, {
        'content/catalogue.json': edited,
      });
      expect((compiled.content.data as { sac: unknown }).sac).toEqual(edited);
      for (const tile of variant.tiles.filter((tile) => tile.type === 'tax')) {
        expect(Number.isSafeInteger(tile.taxAmount)).toBe(true);
        expect(tile.taxAmount).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it('rejects prose-only cards and malformed executable data', () => {
    const proseOnly = structuredClone(catalogue);
    const proseCard = proseOnly.variants[0].chance[0];
    delete (proseCard as Partial<typeof proseCard>).effects;
    expect(() =>
      compileJsonGame(manifest, document, {
        'content/catalogue.json': proseOnly,
      }),
    ).toThrow();

    const malformed = structuredClone(catalogue);
    malformed.variants[0].chance[0].effects = [
      { kind: 'custom', effectId: 'unknown', data: {} },
    ];
    expect(() =>
      compileJsonGame(manifest, document, {
        'content/catalogue.json': malformed,
      }),
    ).toThrow();

    malformed.variants[0].chance[0].effects = [
      { kind: 'custom', effectId: 'sac.money', data: { delta: null } },
    ];
    expect(() =>
      compileJsonGame(manifest, document, {
        'content/catalogue.json': malformed,
      }),
    ).toThrow();
  });
});

describe('Sac à Malices declarative game', () => {
  it('loads a variant and keeps the economic race replayable', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(131);
    await game.start();
    await game.as(1).do('game.configure', { variantId: 'classic' });
    await game.as(1).do('roll', {});
    expect(game.resource(1, 'money')).toBeGreaterThanOrEqual(0);
    expect('pendingPurchase' in game.view(1)).toBe(false);
    expect(await game.replay()).toEqual(game.state());
  });

  it('continues snapshots created before the JSON migration', async () => {
    const game = await testGame(gameDefinition).players(2).seed(132).start();
    const source = game.state();
    source.engine.contentVersion = 'sac-a-malices@content:2959fe7b@format:2';
    const restored = new DeclarativeGameRuntime(gameDefinition).applyActions(
      source,
      [],
    );
    expect(restored.engine.contentVersion).toBe('1');
  });
});
