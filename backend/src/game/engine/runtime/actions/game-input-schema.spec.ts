import { gameInput } from './game-input-schema';
import { GamePayloadValidationError } from '../../../core/domain/errors/game-domain.errors';

it('preserves presentation whitespace when requested without changing input defaults', () => {
  expect(gameInput.string().parse(' texte ')).toBe('texte');
  expect(gameInput.string({ trim: false }).parse(' texte ')).toBe(' texte ');
  expect(() => gameInput.string({ trim: false, max: 2 }).parse(' a ')).toThrow(
    GamePayloadValidationError,
  );
});

it('distinguishes explicit null from missing and numeric values in nullable content', () => {
  const input = gameInput.optional(
    gameInput.union([
      gameInput.literal(null),
      gameInput.number({ integer: true }),
    ]),
  );
  expect(input.parse(null)).toBeNull();
  expect(input.parse(undefined)).toBeUndefined();
  expect(input.parse(0)).toBe(0);
  expect(() => input.parse(false)).toThrow(GamePayloadValidationError);
  expect(gameInput.literal(null).describe()).toEqual({
    type: 'literal',
    value: null,
  });
});

describe('numeric action and choice inputs', () => {
  it('supports strict JSON numbers and closed content objects without changing client defaults', () => {
    const options = { unknownKeys: 'reject' as const };
    const schema = gameInput.object(
      { id: gameInput.number({ integer: true, coerce: false }) },
      options,
    );
    expect(schema.parse({ id: 2 })).toEqual({ id: 2 });
    expect(() => schema.parse({ id: '2' })).toThrow();
    expect(() => schema.parse({ id: 2, secret: true })).toThrow(/secret/);
    expect(
      gameInput
        .object({ id: gameInput.number() })
        .parse({ id: '2', extra: true }),
    ).toEqual({ id: 2 });
    expect(schema.describe()).toHaveProperty('additionalProperties', false);
  });
  it.each([
    null,
    undefined,
    true,
    false,
    '',
    ' ',
    [],
    [1],
    {},
    Infinity,
    NaN,
    'Infinity',
    'NaN',
    '0x10',
    '12tail',
    1n,
    Symbol('number'),
  ])('rejects nonnumeric values without implicit coercion: %s', (value) => {
    expect(() => gameInput.number().parse(value)).toThrow(
      GamePayloadValidationError,
    );
    expect(() => gameInput.numberEnum([0, 1]).parse(value)).toThrow(
      GamePayloadValidationError,
    );
  });

  it('preserves numeric strings used by clients and enforces bounds', () => {
    expect(() => gameInput.number({ integer: true }).parse('1e3')).toThrow();
    expect(() => gameInput.number({ integer: true }).parse('1.0')).toThrow();
    expect(gameInput.number({ integer: true, min: 1, max: 3 }).parse('2')).toBe(
      2,
    );
    expect(gameInput.numberEnum([1, 2]).parse('2')).toBe(2);
    expect(() => gameInput.number({ max: 3 }).parse(4)).toThrow(
      GamePayloadValidationError,
    );
    expect(() => gameInput.number({ integer: true }).parse(1.5)).toThrow(
      GamePayloadValidationError,
    );
    expect(() =>
      gameInput.number({ integer: true }).parse(Number.MAX_SAFE_INTEGER + 1),
    ).toThrow(GamePayloadValidationError);
  });
});
