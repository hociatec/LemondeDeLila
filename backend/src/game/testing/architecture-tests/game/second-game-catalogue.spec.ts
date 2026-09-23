import { compileJsonGame } from '../../../rules/public-api';
import { jsonEffectPacks } from '../../../rules/effect-packs/json-effect-pack-registry';
import { AuthoringError } from '../../../engine/runtime/contracts/authoring-error';
import attempts from '../../fixtures/second-game-attempts/catalogue.json';
import { fixture, object } from './extension-diagnostic-fixture';
import { testGame } from '../../../engine/testing/public-api';
import type { DeclarativeState } from '../../../engine/runtime/state/declarative-state';

type PackKey = (typeof jsonEffectPacks)[number]['documentKey'];
// A new pack cannot bypass the second-game attempt matrix.
const designs: Record<PackKey, string> = attempts;

it('attempts a mechanically different objective for every registered pack', () => {
  expect(Object.keys(designs).sort()).toEqual(
    jsonEffectPacks.map((pack) => pack.documentKey).sort(),
  );
});

it.each(
  jsonEffectPacks.filter((pack) => pack.documentKey !== 'chainedTileRace'),
)(
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

it('chainedTileRace ends prematurely at its terminal tile despite the new objective', async () => {
  const { source, program, manifest } = fixture('chainedTileRace');
  source.victory = {
    kind: 'rounds-completed',
    amount: 10,
    participants: 'all',
    ranking: [{ kind: 'score', direction: 'desc' }],
    ties: 'all',
  };
  const tiles = program.tiles;
  if (!Array.isArray(tiles)) throw new Error('Expected tiles');
  const finish = tiles.findIndex(
    (tile) =>
      object(object(program.tileRules)[String(object(tile).type)]).kind ===
      'finish',
  );
  expect(finish).toBeGreaterThan(0);
  object(source.actions).probe = {
    effects: [
      {
        kind: 'custom',
        effectId: 'race-chained-tile-cards.move',
        data: { delta: finish },
        target: { kind: 'self' },
      },
    ],
  };
  const playing = object(object(source.phases).playing);
  playing.actions = [...(playing.actions as string[]), 'probe'];
  const game = testGame(compileJsonGame(manifest, source)).players(2).seed(91);
  await game.start();
  for (let i = 0; i < 2; i++) {
    const pending = game.state().pending;
    if (!pending?.playerId || !pending.choices?.[0])
      throw new Error('Expected pawn choice');
    await game.choose(pending.playerId, pending.data?.options?.[0]);
  }
  await game.as(game.state().turn?.currentPlayerId ?? 1).do('probe', {});
  const state = game.state() as DeclarativeState<object>;
  expect(state.engine.match.status).toBe('finished');
  expect(state.engine.match.result?.reason).toBe(program.finishReason);
  expect(await game.replay()).toEqual(game.state());
});
