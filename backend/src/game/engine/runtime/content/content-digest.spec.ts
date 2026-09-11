import { contentDigest } from './content-digest';
import { defineGameContent } from './game-content';
import { defineGame } from '../definitions/game-definition';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import { defineAction } from '../definitions/game-definition-builders';
import { gameInput } from '../actions/game-input-schema';

function definition(price: number) {
  return defineGame({
    id: 'saved-content',
    displayName: 'Saved content',
    category: 'test',
    players: { min: 1, max: 2 },
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
    contentVersion: 'fixed',
    content: defineGameContent(
      'saved-content',
      { price },
      { version: 'fixed' },
    ),
  });
}

it('pins snapshots to content bytes even when both declared versions are reused', () => {
  const original = definition(1);
  const runtime = new DeclarativeGameRuntime(original);
  const state = runtime.hydrateInitialState({
    status: 'started',
    phase: 'playing',
    log: [],
    players: [{ id: 1, username: 'Alice' }],
  });
  const saved = JSON.parse(JSON.stringify(state)) as typeof state;
  const before = structuredClone(saved);
  expect(saved).toHaveProperty('engine.contentDigest', original.contentDigest);
  expect(() =>
    new DeclarativeGameRuntime(definition(1)).applyActions(saved, []),
  ).not.toThrow();
  expect(() =>
    new DeclarativeGameRuntime(definition(2)).applyActions(saved, []),
  ).toThrow('incompatible');
  expect(saved).toEqual(before);
});

it('canonicalizes object key order but preserves collection order and types', () => {
  const digest = (data: object) =>
    contentDigest(defineGameContent('canonical', data));
  expect(digest({ z: 1, a: 2 })).toBe(digest({ a: 2, z: 1 }));
  expect(digest({ values: [1, 2] })).not.toBe(digest({ values: [2, 1] }));
  expect(digest({ values: new Set([1, 2]) })).not.toBe(
    digest({ values: [1, 2] }),
  );
  expect(
    digest({
      values: new Map([
        ['a', 1],
        ['b', 2],
      ]),
    }),
  ).not.toBe(
    digest({
      values: new Map([
        ['b', 2],
        ['a', 1],
      ]),
    }),
  );
});
