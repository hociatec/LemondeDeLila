import { createAuthorCodec } from './json-author-codec';
import { authorObject, authorPositive } from './json-author-schema';
import { defineJsonEffectPack } from './json-effect-pack';

it('validates before narrowing, clones input, and captures an immutable grammar', () => {
  const schema = authorObject({ points: authorPositive });
  const codec = createAuthorCodec<{ points: number }>(schema);
  schema.required = [];
  const source = { points: 3 };
  const parsed = codec.parse(source);
  parsed.points = 5;
  expect(source.points).toBe(3);
  for (const value of [
    {},
    { points: '3' },
    { points: 0 },
    { points: 3, extra: true },
  ])
    expect(() => codec.parse(value, 'extension')).toThrow(/extension/);
});

it('never passes malformed input to compilation, reference validation, or choice collection', () => {
  const compile = jest.fn((program: { points: number }) => program.points);
  const choiceIds = jest.fn((program: { points: number }) => [
    String(program.points),
  ]);
  const pack = defineJsonEffectPack({
    scope: 'game-specific',
    domain: 'choice',
    documentKey: 'sample',
    outputKey: 'sample',
    schema: authorObject({ points: authorPositive }),
    compile,
    choiceIds,
  });
  expect(() => pack.compileContribution({ points: 'bad' })).toThrow(
    /sample.points/,
  );
  expect(() => pack.collectChoiceIds({ points: 'bad' })).toThrow(
    /sample.points/,
  );
  expect(compile).not.toHaveBeenCalled();
  expect(choiceIds).not.toHaveBeenCalled();
  expect(pack.collectChoiceIds({ points: 2 })).toEqual(['2']);
  const contribution = pack.compileContribution({ points: 2 });
  expect(contribution).toEqual(
    expect.objectContaining({
      actions: {},
      events: [],
      components: [],
      patterns: [],
    }),
  );
  expect(Object.isFrozen(contribution)).toBe(true);
});
