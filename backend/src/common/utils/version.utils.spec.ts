import {
  isVersionGreater,
  isVersionLower,
  parseVersion,
} from './version.utils';

describe('version utils', () => {
  it('keeps build components independent above 999', () => {
    expect(isVersionLower('1.2.1000.0', '1.3.0.0')).toBe(true);
    expect(isVersionGreater('1.2.1000.1', '1.2.1000.0')).toBe(true);
  });

  it('accepts four numeric components and rejects unsafe ranges', () => {
    expect(parseVersion('1.2.651.0')).not.toBeNull();
    expect(parseVersion('1000.0.0.0')).toBeNull();
    expect(parseVersion('1.10000.0.0')).toBeNull();
  });
});
