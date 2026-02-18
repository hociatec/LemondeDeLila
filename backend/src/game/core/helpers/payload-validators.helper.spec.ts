import {
  optionalInt,
  optionalString,
  requiredArrayIndex,
  requiredEnumValue,
  requiredInt,
  requiredString,
} from './payload-validators.helper';

describe('payload-validators.helper', () => {
  it('reads required and optional integers', () => {
    expect(requiredInt({ value: '12' }, 'value')).toBe(12);
    expect(optionalInt({ value: '3' }, 'value')).toBe(3);
    expect(optionalInt({ value: '' }, 'value')).toBeUndefined();
    expect(() => requiredInt({ value: '12.9' }, 'value')).toThrow(
      'value est requis.',
    );
  });

  it('reads required and optional strings', () => {
    expect(requiredString({ value: '  abc ' }, 'value')).toBe('abc');
    expect(optionalString({ value: '  abc ' }, 'value')).toBe('abc');
    expect(optionalString({ value: '  ' }, 'value')).toBeUndefined();
  });

  it('validates enum values', () => {
    expect(
      requiredEnumValue({ move: 'left' }, 'move', ['left', 'right'] as const),
    ).toBe('left');
    expect(() =>
      requiredEnumValue({ move: 'up' }, 'move', ['left', 'right'] as const),
    ).toThrow('move est invalide.');
  });

  it('validates array index bounds', () => {
    expect(requiredArrayIndex({ idx: 1 }, 'idx', 3)).toBe(1);
    expect(() => requiredArrayIndex({ idx: 4 }, 'idx', 3)).toThrow(
      'idx est hors limites.',
    );
  });

  it('throws clear errors for missing required fields', () => {
    expect(() => requiredInt({}, 'value')).toThrow('value est requis.');
    expect(() => requiredString({}, 'value')).toThrow('value est requis.');
  });
});
