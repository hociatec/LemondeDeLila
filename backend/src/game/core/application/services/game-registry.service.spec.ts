import { GameRegistryService } from './game-registry.service';
import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameCatalogEntryRecord } from '../models/game-catalog-entry.model';
import type { GameCatalogOverridesService } from '../../../engine/application/services/game-catalog-overrides.service';

it('rejects replacement of an existing game runtime while allowing the same instance', () => {
  const service = new GameRegistryService({
    listEntries: () => [],
    readTextFile: () => '',
  });
  const original = { gameType: 'example' } as GameRuntime;
  service.register(original);
  expect(() => service.register(original)).not.toThrow();
  expect(() =>
    service.register({ gameType: 'example' } as GameRuntime),
  ).toThrow('dupliqué');
  expect(service.getHandler('example')).toBe(original);
});

it('rejects duplicate manifest codes instead of silently selecting the last entry', async () => {
  const entry: GameCatalogEntryRecord = {
    root: 'first',
    manifestPath: 'first/manifest.json',
    manifest: { code: 'example' },
  };
  const service = new GameRegistryService({
    listEntries: () => [entry, { ...entry, root: 'second' }],
    readTextFile: () => '',
  });
  await expect(service.listGames()).rejects.toThrow('dupliqué');
});

it('refuses inconsistent catalogue limits before registering a runtime', () => {
  const service = new GameRegistryService({
    listEntries: () => [
      {
        root: 'example',
        manifestPath: 'example/manifest.json',
        manifest: {
          code: 'example',
          engine: 'example',
          name: 'Example',
          minPlayers: 2,
          maxPlayers: 10,
        },
      },
    ],
    readTextFile: () => '',
  });
  const runtime = {
    gameType: 'example',
    displayName: 'Example',
    minPlayers: 2,
    maxPlayers: 6,
  } as GameRuntime;
  expect(() => service.register(runtime)).toThrow('maxPlayers');
  expect(service.getHandler('example')).toBeUndefined();
});

it('keeps administrative player limits inside the supported runtime range', async () => {
  const overrides = {
    reload: jest.fn(async () => undefined),
    getGameOverride: () => ({ minPlayers: 1, maxPlayers: 10 }),
  } as unknown as GameCatalogOverridesService;
  const service = new GameRegistryService(
    { listEntries: () => [], readTextFile: () => '' },
    overrides,
  );
  service.register({
    gameType: 'panier-express',
    displayName: 'Panier Express',
    minPlayers: 2,
    maxPlayers: 6,
  } as GameRuntime);
  expect(await service.listGames()).toEqual([
    expect.objectContaining({ minPlayers: 2, maxPlayers: 6 }),
  ]);
  expect(overrides.reload).toHaveBeenCalledTimes(1);
});
