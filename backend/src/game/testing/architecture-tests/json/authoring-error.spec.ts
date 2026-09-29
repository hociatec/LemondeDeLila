import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import { authoringProperty } from '../../../engine/runtime/contracts/authoring-diagnostics';
import { compileJsonGame } from '../../../rules/public-api';
import { defineGameContent } from '../../../engine/runtime/content/game-content';
import manifest from '../../../games/vents-sacres/lama/manifest.json';
import document from '../../../games/vents-sacres/lama/game.json';

function diagnostic(run: () => unknown): AuthoringError {
  try {
    run();
  } catch (error) {
    if (error instanceof AuthoringError) return error;
    throw error;
  }
  throw new Error('Expected authoring failure');
}

it('reports semantic failures in the native pattern JSON surface', () => {
  const source = structuredClone(document) as Record<string, unknown> & {
    patterns: Array<{ config: Record<string, unknown> }>;
  };
  source.patterns[0].config.specialValue = 'missing';
  const error = diagnostic(() => compileJsonGame(manifest, source));
  expect(error).toMatchObject({
    code: 'GAME_AUTHORING_ERROR',
    path: 'game.json.patterns[0].config.specialValue',
    expected: 'member of orderedValues',
    received: 'missing',
  });
  expect(error.message).toContain(error.path);
});

it('reports grammar failures at the array item and property', () => {
  const source = structuredClone(document) as Record<string, unknown> & {
    patterns: Array<{ config: Record<string, unknown> }>;
  };
  source.patterns[0].config.orderedValues = [1, false];
  const error = diagnostic(() => compileJsonGame(manifest, source));
  expect(error.path).toBe('game.json.patterns[0].config.orderedValues[1]');
  expect(error.received).toBe(false);
});

it('reports manifest validation through the same diagnostic contract', () => {
  expect(
    diagnostic(() => compileJsonGame({ ...manifest, maxPlayers: 0 }, document)),
  ).toMatchObject({
    code: 'GAME_AUTHORING_ERROR',
    path: 'manifest.maxPlayers',
    received: 0,
  });
});

it('preserves structured schema diagnostics through content loading', () => {
  const original = new AuthoringError(
    'game.json.actions.play',
    'known action',
    'unknown',
  );
  expect(
    diagnostic(() =>
      defineGameContent(
        'diagnostics',
        {},
        {
          schema: {
            parse: () => {
              throw original;
            },
          },
        },
      ),
    ),
  ).toBe(original);
});

it('reads diagnostics without invoking accessors or inherited properties', () => {
  const getter = jest.fn(() => 'secret');
  const value = Object.create({ inherited: 'secret' });
  Object.defineProperty(value, 'accessor', { get: getter });
  expect(authoringValueAt(value, 'accessor')).toBeUndefined();
  expect(authoringValueAt(value, 'inherited')).toBeUndefined();
  expect(getter).not.toHaveBeenCalled();
  expect(authoringValueAt({ cards: [{ value: 4 }] }, 'cards[0].value')).toBe(4);
});

it.each([
  'contains.dot',
  'bracket[0]',
  'quote"key',
  'slash\\key',
  '',
  'line\nbreak',
  '__proto__',
])(
  'reads a literal dictionary key %j without confusing it with a path',
  (key) => {
    const source = { bindings: Object.fromEntries([[key, { value: 17 }]]) };
    const path = `${authoringProperty('bindings', key)}.value`;
    expect(authoringValueAt(source, path)).toBe(17);
  },
);

it.each(['cards[bad].value', 'cards[0]trailing', '.cards[0]', 'cards..value'])(
  'rejects a malformed path %s',
  (path) => {
    expect(authoringValueAt({ cards: [{ value: 17 }] }, path)).toBeUndefined();
  },
);
