import { testGame } from '../../../engine/testing/public-api';

import gameDefinition from './game';
import { SAC_VARIANTS } from './content';
import { parseSacCard } from './card-content';

describe('Sac structured cards', () => {
  it.each(SAC_VARIANTS.map((variant) => [variant.id, variant] as const))(
    'validates every deck and tax in %s independently of narrative text',
    (_id, variant) => {
      for (const card of [...variant.chance, ...variant.community]) {
        const edited = parseSacCard({
          ...card,
          text: 'Payez 99999 puis avancez de 999 cases',
        });
        expect(edited.effects).toEqual(card.effects);
        expect(edited.retained).toBe(card.retained);
      }
      for (const tile of variant.tiles.filter((tile) => tile.type === 'tax')) {
        expect(Number.isSafeInteger(tile.taxAmount)).toBe(true);
        expect(tile.taxAmount).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it('rejects prose-only cards and malformed executable data', () => {
    const card = SAC_VARIANTS[0].chance[0];
    expect(() => parseSacCard({ id: 1, text: 'Recevez 200' })).toThrow();
    expect(() =>
      parseSacCard({
        ...card,
        effects: [{ kind: 'custom', effectId: 'unknown', data: {} }],
      }),
    ).toThrow();
    expect(() =>
      parseSacCard({
        ...card,
        effects: [
          { kind: 'custom', effectId: 'sac.money', data: { delta: null } },
        ],
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
});
