import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import type { DeclarativeState } from '../state/declarative-state';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

it.each([0, 2, '1', null])(
  'refuses unsupported author schema version %j',
  (schemaVersion) => {
    expect(() =>
      compileJsonGame(manifest, { ...document, schemaVersion }),
    ).toThrow();
  },
);

it.each([
  'algorithmVersion',
  'rulesVersion',
  'contentVersion',
  'contentDigest',
] as const)(
  'refuses an incompatible snapshot %s before any mutation',
  async (field) => {
    const definition = compileJsonGame(manifest, document);
    const game = await testGame(definition).players(2).seed(42).start();
    const source = game.state() as DeclarativeState<Record<string, never>>;
    source.engine[field] = field === 'algorithmVersion' ? '1' : 'previous';
    const before = structuredClone(source);
    expect(() =>
      new DeclarativeGameRuntime(definition).applyActions(source, []),
    ).toThrow();
    expect(source).toEqual(before);
  },
);

it('refuses a legacy snapshot without an engine algorithm header', async () => {
  const definition = compileJsonGame(manifest, document);
  const game = await testGame(definition).players(2).seed(42).start();
  const source = game.state() as DeclarativeState<Record<string, never>>;
  delete source.engine.algorithmVersion;
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(definition).applyActions(source, []),
  ).toThrow();
  expect(source).toEqual(before);
});

it('detects a rule change even when the author forgets to increment version labels', async () => {
  const original = compileJsonGame(manifest, document);
  const game = await testGame(original).players(2).seed(42).start();
  const changed = compileJsonGame(manifest, {
    ...document,
    actions: { advance: { effects: [{ kind: 'gain-score', amount: 100 }] } },
  });
  expect(changed.rulesVersion).toBe(original.rulesVersion);
  expect(changed.contentVersion).toBe(original.contentVersion);
  expect(changed.contentDigest).not.toBe(original.contentDigest);
  const source = game.state();
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(changed).applyActions(source, []),
  ).toThrow();
  expect(source).toEqual(before);
});

it('detects reordered catalogue content without trusting its author label', async () => {
  const original = compileJsonGame(manifest, document);
  const game = await testGame(original).players(2).seed(42).start();
  const changed = compileJsonGame(manifest, {
    ...document,
    components: document.components.map((component) =>
      component.component === 'cards.deck'
        ? { ...component, cards: [...(component.cards ?? [])].reverse() }
        : component,
    ),
  });
  expect(changed.contentVersion).toBe(original.contentVersion);
  expect(changed.contentDigest).not.toBe(original.contentDigest);
  const source = game.state();
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(changed).applyActions(source, []),
  ).toThrow();
  expect(source).toEqual(before);
});
