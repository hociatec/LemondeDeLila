import { compareUpdateVersions, parseUpdateVersion } from './update-version';

describe('update versions', () => {
  it('compares structured versions without lexical ordering', () => {
    expect(compareUpdateVersions('1.10.0', '1.9.99')).toBe(1);
    expect(compareUpdateVersions('1.4.2.1', '1.4.2')).toBe(1);
  });

  it('rejects ambiguous or oversized components', () => {
    expect(parseUpdateVersion('1.02.3')).toBeNull();
    expect(parseUpdateVersion('1.2.1000000')).toBeNull();
  });
});
