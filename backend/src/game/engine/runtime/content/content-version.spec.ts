import { stableContentVersion } from './content-version';

describe('stableContentVersion', () => {
  it('orders object keys independently of the host locale and insertion order', () => {
    const compare = jest
      .spyOn(String.prototype, 'localeCompare')
      .mockImplementation(() => {
        throw new Error('Locale-dependent content identity');
      });
    try {
      expect(stableContentVersion('test', { z: 1, A: 2, é: 3 })).toBe(
        stableContentVersion('test', { é: 3, A: 2, z: 1 }),
      );
    } finally {
      compare.mockRestore();
    }
  });

  it('preserves the meaningful order of arrays and collections', () => {
    expect(stableContentVersion('test', { values: [1, 2] })).not.toBe(
      stableContentVersion('test', { values: [2, 1] }),
    );
    expect(stableContentVersion('test', { values: new Set([1, 2]) })).not.toBe(
      stableContentVersion('test', { values: new Set([2, 1]) }),
    );
  });
});
