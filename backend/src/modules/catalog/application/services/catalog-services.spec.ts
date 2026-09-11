import { CatalogCacheService } from './catalog-cache.service';
import { CatalogMapperService } from './catalog-mapper.service';
import type { CatalogGameSourcePort } from '../ports/catalog-game-source.port';
import { ListCatalogGamesService } from '../use-cases/catalog/list-catalog-games.service';

describe('catalog services', () => {
  it('does not let an in-flight read undo invalidation or a newer fill', async () => {
    let resolveRead!: (value: { id: string; name: string }[]) => void;
    const source = {
      listGames: jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRead = resolve;
            }),
        )
        .mockResolvedValue([{ id: 'new', name: 'New' }]),
    } as CatalogGameSourcePort;
    const cache = new CatalogCacheService({ ttlMs: 100 }, { now: () => 1000 });
    const service = new ListCatalogGamesService(
      source,
      cache,
      new CatalogMapperService(),
    );
    const pending = service.execute();
    cache.clear();
    expect((await service.execute())[0].id).toBe('new');
    resolveRead([{ id: 'old', name: 'Old' }]);
    expect((await pending)[0].id).toBe('old');
    expect((await service.execute())[0].id).toBe('new');
    expect(source.listGames).toHaveBeenCalledTimes(2);
  });

  it('isolates the cache from source and caller mutations', () => {
    let now = 1000;
    const cache = new CatalogCacheService({ ttlMs: 100 }, { now: () => now });
    const games = new CatalogMapperService().toCatalogGames([
      { id: 'lama', name: 'Lama' },
    ]);
    const returned = cache.setGames(games);
    games[0].name = 'Source mutation';
    returned[0].categories.push('Caller category');
    const read = cache.getGames()!;
    expect(read[0].name).toBe('Lama');
    expect(read[0].categories).not.toContain('Caller category');
    read.pop();
    expect(cache.getGames()).toHaveLength(1);
    now = 1100;
    expect(cache.getGames()).toBeNull();
  });

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

  it('sorts games and category projections with a locale-independent order', () => {
    const mapper = new CatalogMapperService();
    const games = mapper.toCatalogGames([
      { id: 'zèbre', name: 'Zèbre', category: 'Z' },
      { id: 'alpha', name: 'Alpha', category: 'A' },
      { id: 'beta', name: 'Beta', category: 'B' },
    ]);
    expect(games.map((game) => game.id)).toEqual(['alpha', 'beta', 'zèbre']);
    expect(mapper.listCategoryNames(games)).toEqual(['A', 'B', 'Z']);
    expect(mapper.buildFlatCategories(games).map((item) => item.id)).toEqual([
      'a',
      'b',
      'z',
    ]);
  });

  it('merges equivalent collection spellings into one shelf', () => {
    const mapper = new CatalogMapperService();
    const games = mapper.toCatalogGames([
      {
        id: 'oie',
        name: "Jeu de l'oie",
        subcategory: 'VentsSacres',
      },
      {
        id: 'morpion',
        name: 'Morpion',
        subcategory: 'Les Vents Sacrés',
      },
    ]);

    expect(games.map((game) => game.category)).toEqual([
      'Vents Sacrés',
      'Vents Sacrés',
    ]);
    expect(mapper.buildCategoryTree(games)).toEqual([
      expect.objectContaining({ id: 'vents-sacres', name: 'Vents Sacrés' }),
    ]);
  });

  it('expires cached catalog data and returns defensive list identities', () => {
    jest.useFakeTimers().setSystemTime(1_000);
    const cache = new CatalogCacheService(
      { ttlMs: 100 },
      { now: () => Date.now() },
    );
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
    const cache = new CatalogCacheService(
      { ttlMs: 1_000 },
      { now: () => Date.now() },
    );
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
      new CatalogCacheService({ ttlMs: 1_000 }, { now: () => Date.now() }),
      new CatalogMapperService(),
    );
    await expect(service.execute()).rejects.toThrow('registry unavailable');
    await expect(service.execute()).resolves.toHaveLength(1);
  });
});
