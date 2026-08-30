import { CatalogCacheService } from './catalog-cache.service';
import { CatalogMapperService } from './catalog-mapper.service';
import type { CatalogGameSourcePort } from '../ports/catalog-game-source.port';
import { ListCatalogGamesService } from '../use-cases/catalog/list-catalog-games.service';

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

  it('integrates source, normalization and cache without re-reading definitions', async () => {
    const source = {
      listGames: jest.fn().mockResolvedValue([
        { id: 'lama', name: 'Lama', minPlayers: 1, maxPlayers: 999 },
        { id: '', name: 'invalid' },
      ]),
    } as unknown as CatalogGameSourcePort;
    const cache = new CatalogCacheService({ ttlMs: 1_000 });
    const service = new ListCatalogGamesService(
      source,
      cache,
      new CatalogMapperService(),
    );

    await expect(service.execute()).resolves.toEqual([
      expect.objectContaining({ id: 'lama', minPlayers: 1, maxPlayers: 64 }),
    ]);
    await service.execute();
    expect(source.listGames).toHaveBeenCalledTimes(1);
  });

  it('does not poison the cache when the source fails', async () => {
    const source = {
      listGames: jest
        .fn()
        .mockRejectedValueOnce(new Error('registry unavailable'))
        .mockResolvedValueOnce([{ id: 'lama', name: 'Lama' }]),
    } as unknown as CatalogGameSourcePort;
    const service = new ListCatalogGamesService(
      source,
      new CatalogCacheService({ ttlMs: 1_000 }),
      new CatalogMapperService(),
    );
    await expect(service.execute()).rejects.toThrow('registry unavailable');
    await expect(service.execute()).resolves.toHaveLength(1);
  });
});
