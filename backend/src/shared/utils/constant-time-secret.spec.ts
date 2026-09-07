import { constantTimeSecretEquals } from './constant-time-secret';

describe('constantTimeSecretEquals', () => {
  it('accepts identical non-empty secrets', () => {
    expect(constantTimeSecretEquals('same-secret', 'same-secret')).toBe(true);
  });

  it.each([
    ['', ''],
    ['expected', ''],
    ['', 'provided'],
    ['expected', 'different'],
    ['short', 'a-much-longer-secret'],
  ])('rejects non-matching or empty values', (expected, provided) => {
    expect(constantTimeSecretEquals(expected, provided)).toBe(false);
  });
});
