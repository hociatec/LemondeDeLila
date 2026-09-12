import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from '../../../games/vents-sacres/morpion/manifest.json';
import document from '../../../games/vents-sacres/morpion/game.json';
import pawns from '../../../games/vents-sacres/morpion/content/pawns.json';
import reference from '../../fixtures/morpion-before-json-parity.json';
import type { DeclarativeState } from '../../../engine/runtime/state/declarative-state';

it('rejects the previous Morpion rules version without mutating its snapshot', async () => {
  const definition = compileJsonGame(manifest, document, {
    'content/pawns.json': pawns,
  });
  const game = await testGame(definition).players(2).seed(3).start();
  const source = game.state() as DeclarativeState<Record<string, never>>;
  source.engine.rulesVersion = '1';
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(definition).applyActions(source, []),
  ).toThrow(/incompatible/);
  expect(source).toEqual(before);
});

it.each(reference)(
  'preserves the full pre-migration Morpion trace for seed $seed',
  async ({ seed, commands, events, sha256, status }) => {
    const definition = compileJsonGame(manifest, document, {
      'content/pawns.json': pawns,
    });
    const game = await testGame(definition)
      .players(['One', 'Two'])
      .seed(seed)
      .start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      {
        maxCommands: commands,
        startAtMs: 1000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(status);
    const trace = result.events
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(sha256);
  },
);
