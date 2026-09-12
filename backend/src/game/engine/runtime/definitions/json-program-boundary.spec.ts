import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

it.each([
  { execute: 'globalThis.compromised = true' },
  { script: 'process.exit()' },
  { variables: { score: 0 } },
  { forEach: { player: 'all', do: [] } },
  { while: { condition: true, do: [] } },
  { imports: ['node:fs'] },
])('rejects executable or general-purpose program fields %j', (extension) => {
  expect(() =>
    compileJsonGame(manifest, { ...document, ...extension }),
  ).toThrow();
});

it.each([
  { kind: 'eval', code: 'process.exit()' },
  { kind: 'for-each', variable: 'player', values: 'players', effects: [] },
  { kind: 'set-variable', name: 'score', value: 1 },
  { kind: 'gain-score', amount: 'score + 1' },
  {
    kind: 'custom',
    effectId: 'unregistered-code',
    data: { code: 'process.exit()' },
  },
])('rejects pseudo-code and unregistered custom effects %j', (effect) => {
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      actions: { advance: { effects: [effect] } },
    }),
  ).toThrow();
});

it('rejects author callbacks and accessors before executing either', () => {
  const callback = jest.fn();
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      actions: { advance: { execute: callback } },
    }),
  ).toThrow();
  const source = structuredClone(document);
  Object.defineProperty(source, 'setup', { enumerable: true, get: callback });
  expect(() => compileJsonGame(manifest, source)).toThrow();
  expect(callback).not.toHaveBeenCalled();
});

it('preserves code-looking descriptive content as inert text', () => {
  const text = 'globalThis.compromised = true; require("node:fs")';
  const definition = compileJsonGame(manifest, {
    ...document,
    actions: { advance: { effects: [], documentation: text } },
  });
  expect(definition.actions.advance.documentation).toBe(text);
});
