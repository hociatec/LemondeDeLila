import { normalizeInputStrings } from './input-normalization';

describe('normalizeInputStrings', () => {
  it('normalizes user text recursively but preserves opaque credentials', () => {
    expect(
      normalizeInputStrings({
        username: '  Ｌila  ',
        nested: { subject: '  Bonjour  ' },
        password: '  exact password  ',
        refreshToken: '  exact-token  ',
      }),
    ).toEqual({
      username: 'Lila',
      nested: { subject: 'Bonjour' },
      password: '  exact password  ',
      refreshToken: '  exact-token  ',
    });
  });
});
