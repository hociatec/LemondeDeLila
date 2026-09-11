import {
  assertConditionJson,
  assertEffectJson,
  assertTargetJson,
} from './effect-json-schema';

it.each([
  [{ kind: 'complete-turn', extra: true }],
  [{ kind: 'move', trackId: 'board', spaces: '2' }],
  [
    {
      kind: 'move',
      trackId: 'board',
      spaces: 1,
      target: { kind: 'self', playerId: 1 },
    },
  ],
  [
    {
      kind: 'conditional',
      condition: { kind: 'all', conditions: null },
      then: [],
    },
  ],
  [{ kind: 'gain-score', amount: NaN }],
  [
    {
      kind: 'gain-score',
      amount: 1,
      target: { kind: 'player', playerId: 1.5 },
    },
  ],
  [{ kind: 'add-status', status: 'shield', data: { fn: () => 1 } }],
  [{ kind: 'add-status', status: 'shield', data: new Date(0) }],
])('rejects fields outside the canonical JSON grammar', (value) =>
  expect(() => assertEffectJson(value)).toThrow(),
);

it('validates nested conditions and targets independently of the executor', () => {
  expect(() =>
    assertConditionJson({
      kind: 'not',
      condition: {
        kind: 'has-resource',
        resource: 'gold',
        amount: 2,
        target: { kind: 'self' },
      },
    }),
  ).not.toThrow();
  expect(() =>
    assertTargetJson({
      kind: 'chosen-player',
      playerIds: [1, 2],
      optional: true,
    }),
  ).not.toThrow();
  expect(() => assertConditionJson({ kind: 'all', conditions: [] })).toThrow();
  expect(() =>
    assertTargetJson({ kind: 'self', expression: 'players[0]' }),
  ).toThrow();
});

it('bounds recursion and refuses cycles and accessors without executing them', () => {
  let condition: unknown = { kind: 'has-status', status: 'shield' };
  for (let i = 0; i < 70; i++) condition = { kind: 'not', condition };
  expect(() => assertConditionJson(condition)).toThrow(/limit/);
  const cyclic: Record<string, unknown> = { kind: 'not' };
  cyclic.condition = cyclic;
  expect(() => assertConditionJson(cyclic)).toThrow(/cyclic/);
  const getter = jest.fn(() => 'self');
  expect(() =>
    assertTargetJson(
      Object.defineProperty({}, 'kind', { get: getter, enumerable: true }),
    ),
  ).toThrow();
  expect(getter).not.toHaveBeenCalled();
});
