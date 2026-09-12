import { BotNameCacheService } from './bot-name-cache.service';
import { BotNameRegistryService } from './bot-name-registry.service';

it('does not repopulate the cache with a read started before invalidation', async () => {
  let resolveRead!: (names: string[]) => void;
  const registry = Object.assign(
    Object.create(BotNameRegistryService.prototype) as BotNameRegistryService,
    {
      listEnabledNames: jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<string[]>((resolve) => {
              resolveRead = resolve;
            }),
        )
        .mockResolvedValue(['New']),
    },
  );
  const cache = new BotNameCacheService(
    registry,
    { namesCacheTtlMs: 100 },
    { now: () => 1000 },
  );
  const pending = cache.getEnabledNames();
  cache.invalidate();
  expect(await cache.getEnabledNames()).toEqual(['New']);
  resolveRead(['Old']);
  expect(await pending).toEqual(['Old']);
  expect(await cache.getEnabledNames()).toEqual(['New']);
  expect(registry.listEnabledNames).toHaveBeenCalledTimes(2);
});

it('expires at the injected clock boundary and isolates returned names', async () => {
  let now = 0;
  const names = ['One'];
  const registry = Object.assign(
    Object.create(BotNameRegistryService.prototype) as BotNameRegistryService,
    {
      listEnabledNames: jest.fn().mockResolvedValue(names),
    },
  );
  const cache = new BotNameCacheService(
    registry,
    { namesCacheTtlMs: 100 },
    { now: () => now },
  );
  (await cache.getEnabledNames()).push('Caller');
  names.push('Source');
  now = 99;
  expect(await cache.getEnabledNames()).toEqual(['One']);
  now = 100;
  expect((await cache.getEnabledNames()).sort()).toEqual(['One', 'Source']);
  expect(registry.listEnabledNames).toHaveBeenCalledTimes(2);
});

it('refreshes from the registry for a name-selection decision', async () => {
  const registry = Object.assign(
    Object.create(BotNameRegistryService.prototype) as BotNameRegistryService,
    {
      listEnabledNames: jest
        .fn()
        .mockResolvedValueOnce(['Stale'])
        .mockResolvedValueOnce(['Current']),
    },
  );
  const cache = new BotNameCacheService(
    registry,
    { namesCacheTtlMs: 10_000 },
    { now: () => 1_000 },
  );
  await expect(cache.getEnabledNames()).resolves.toEqual(['Stale']);
  await expect(cache.refreshEnabledNames()).resolves.toEqual(['Current']);
  expect(registry.listEnabledNames).toHaveBeenCalledTimes(2);
});
