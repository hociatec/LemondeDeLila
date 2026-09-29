import { compileJsonGame } from '../../../rules/public-api';
import { jsonEffectPacks } from '../../../rules/effect-packs/json-effect-pack-registry';
import { AuthoringError } from '../../../engine/runtime/contracts/authoring-error';
import attempts from '../../fixtures/second-game-attempts/catalogue.json';
import { fixture } from './extension-diagnostic-fixture';

type PackKey = (typeof jsonEffectPacks)[number]['documentKey'];
// A new pack cannot bypass the second-game attempt matrix.
const designs: Record<PackKey, string> = attempts;

it('attempts a mechanically different objective for every registered pack', () => {
  expect(jsonEffectPacks.filter((pack) => !designs[pack.documentKey])).toEqual(
    [],
  );
});

it.each(jsonEffectPacks)(
  '$documentKey: records the independent-objective limitation without promoting the pack',
  (pack) => {
    const { source, manifest } = fixture(pack.documentKey);
    expect(designs[pack.documentKey].length).toBeGreaterThan(30);
    expect(() => compileJsonGame(manifest, source)).not.toThrow();
    source.victory = {
      kind: 'rounds-completed',
      amount: 10,
      participants: 'all',
      ranking: [{ kind: 'score', direction: 'desc' }],
      ties: 'all',
    };
    try {
      compileJsonGame(manifest, source);
      throw new Error('Expected independent-objective limitation');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoringError);
      expect(error).toMatchObject({ path: 'game.json.victory.kind' });
    }
    expect(pack.scope).toBe('game-specific');
  },
);
