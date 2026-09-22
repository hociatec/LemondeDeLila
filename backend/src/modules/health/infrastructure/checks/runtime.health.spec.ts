import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { RuntimeHealthIndicator } from './runtime.health';

describe('RuntimeHealthIndicator', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'lila-health-'));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it.each(['open', 'write'] as const)(
    'cleans only owned probe files after a %s failure',
    async (failure) => {
      const config = {
        get: (key: string, fallback?: unknown) =>
          key === 'HEALTH_CHECK_PATH' ? root : fallback,
      } as unknown as ConfigService;
      const indicator = new RuntimeHealthIndicator(config);
      const remove = jest.spyOn(fs, 'rm');
      const open = fs.open.bind(fs);
      if (failure === 'open')
        jest
          .spyOn(fs, 'open')
          .mockRejectedValueOnce(new Error('access denied'));
      else
        jest.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
          const handle = await open(...args);
          jest
            .spyOn(handle, 'writeFile')
            .mockRejectedValueOnce(new Error('disk full'));
          return handle;
        });
      try {
        await expect(indicator.checkStorage('storage')).rejects.toThrow(
          'Storage check failed',
        );
        expect(remove).toHaveBeenCalledTimes(failure === 'open' ? 0 : 1);
        expect(await readdir(root)).toEqual([]);
      } finally {
        indicator.onModuleDestroy();
      }
    },
  );

  it('isolates concurrent storage probes and leaves existing probe files untouched', async () => {
    const sentinel = path.join(root, `.health-write-${process.pid}`);
    await writeFile(sentinel, 'another probe');
    const config = {
      get: (key: string, fallback?: unknown) =>
        key === 'HEALTH_CHECK_PATH'
          ? root
          : key === 'HEALTH_MIN_FREE_BYTES'
            ? 0
            : fallback,
    } as unknown as ConfigService;
    const indicator = new RuntimeHealthIndicator(config);
    try {
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => indicator.checkStorage('storage')),
      );
      expect(results.every((result) => result.status === 'fulfilled')).toBe(
        true,
      );
      expect(await readFile(sentinel, 'utf8')).toBe('another probe');
      expect(await readdir(root)).toEqual([path.basename(sentinel)]);
    } finally {
      indicator.onModuleDestroy();
    }
  });

  it('checks event-loop lag and writable storage with free-space metadata', async () => {
    const values: Record<string, unknown> = {
      HEALTH_CHECK_PATH: root,
      HEALTH_MIN_FREE_BYTES: 0,
      HEALTH_MAX_EVENT_LOOP_LAG_MS: 10_000,
    };
    const config = {
      get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    } as unknown as ConfigService;
    const indicator = new RuntimeHealthIndicator(config);

    expect(indicator.checkEventLoop('eventLoop')).toMatchObject({
      eventLoop: { status: 'up' },
    });
    await expect(indicator.checkStorage('storage')).resolves.toMatchObject({
      storage: { status: 'up', path: root },
    });
    indicator.onModuleDestroy();
  });
});
