import { CatalogCacheService } from './catalog-cache.service';
import { CatalogMapperService } from './catalog-mapper.service';

describe('catalog services', () => {
  it('drops missing and duplicate ids while applying bounded defaults', () => {
    const games = new CatalogMapperService().toCatalogGames([
      { id: '', name: 'Invalid' },
      { id: 'lama', name: 'Lama', category: 'vents-sacres' },
      { id: 'lama', name: 'Duplicate' },
    ]);
    expect(games).toHaveLength(1);
    expect(games[0]).toEqual(
      expect.objectContaining({
        id: 'lama',
        minPlayers: 2,
        maxPlayers: 6,
        category: 'Vents Sacres',
      }),
    );
  });

  it('expires cached catalog data and returns defensive list identities', () => {
    jest.useFakeTimers().setSystemTime(1_000);
    const cache = new CatalogCacheService({ ttlMs: 100 });
    cache.setGames([]);
    expect(cache.getGames()).toEqual([]);
    jest.setSystemTime(1_101);
    expect(cache.getGames()).toBeNull();
    jest.useRealTimers();
  });
});
