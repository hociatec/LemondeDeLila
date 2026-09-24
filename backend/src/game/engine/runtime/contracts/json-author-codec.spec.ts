import { createAuthorCodec } from './json-author-codec';
import { authorObject, authorPositive } from './json-author-schema';
import { defineJsonEffectPack } from './json-effect-pack';
import type {
  JsonEffectPackCapability,
  JsonEffectPackHandlerContext,
} from './json-effect-pack';

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
    capabilities: [],
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

it('checks declared capabilities at registration and after handler construction', () => {
  const base = {
    scope: 'game-specific' as const,
    domain: 'choice' as const,
    documentKey: 'sample',
    outputKey: 'sample',
    schema: authorObject({ points: authorPositive }),
    compile: (program: { points: number }) => program.points,
  };
  expect(() =>
    defineJsonEffectPack({ ...base, capabilities: [], actions: () => ({}) }),
  ).toThrow(/sample.capabilities.actions/);
  expect(() =>
    defineJsonEffectPack({ ...base, capabilities: ['actions', 'actions'] }),
  ).toThrow(/sample.capabilities/);
  const context: JsonEffectPackHandlerContext = {
    selectedBot: jest.fn(),
    recipeBot: jest.fn(),
    fallbackRecipeBot: jest.fn(),
    publicStatuses: jest.fn(),
    actionFor: jest.fn(),
  };
  const hidden = defineJsonEffectPack({
    ...base,
    capabilities: [],
    handlers: () => ({ resourceIds: ['energy'] }),
  });
  expect(() =>
    hidden.compileContribution({ points: 2 }).handlers(context),
  ).toThrow(/sample.capabilities.resourceIds/);
  const capabilities: JsonEffectPackCapability[] = ['resourceIds'];
  const valid = defineJsonEffectPack({
    ...base,
    capabilities,
    handlers: () => ({ resourceIds: ['energy'] }),
  });
  capabilities.length = 0;
  expect(Object.isFrozen(valid.capabilities)).toBe(true);
  expect(
    valid.compileContribution({ points: 2 }).handlers(context).resourceIds,
  ).toEqual(['energy']);
  Object.defineProperty(capabilities, '0', {
    value: 'invented',
    enumerable: true,
  });
  expect(() => defineJsonEffectPack({ ...base, capabilities })).toThrow(
    /supported capability name/,
  );
});
