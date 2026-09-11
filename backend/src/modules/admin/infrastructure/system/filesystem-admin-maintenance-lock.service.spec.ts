import { ConflictException } from '@nestjs/common';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FilesystemAdminMaintenanceLockService } from './filesystem-admin-maintenance-lock.service';

describe('FilesystemAdminMaintenanceLockService', () => {
  let directory: string;
  let service: FilesystemAdminMaintenanceLockService;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'lila-maintenance-lock-'));
    service = new FilesystemAdminMaintenanceLockService({
      get: () => join(directory, 'maintenance.lock'),
    } as never);
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('rejects a concurrent incompatible operation and releases afterward', async () => {
    await service.runExclusive('build', async () => {
      await expect(
        service.runExclusive('migrations', () => undefined),
      ).rejects.toBeInstanceOf(ConflictException);
    });
    await expect(
      service.runExclusive('migrations', () => undefined),
    ).resolves.toBeUndefined();
  });

  it('keeps the lock until an asynchronous operation settles', async () => {
    let finish!: () => void;
    const pending = service.runExclusive(
      'build',
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    await expect(
      service.runExclusive('restart', () => undefined),
    ).rejects.toBeInstanceOf(ConflictException);
    finish();
    await pending;
    await expect(
      service.runExclusive('restart', () => undefined),
    ).resolves.toBeUndefined();
  });

  it('publishes complete owner metadata without keeping temporary files', async () => {
    await service.runExclusive('build', () => {
      const metadata: unknown = JSON.parse(
        readFileSync(join(directory, 'maintenance.lock'), 'utf8'),
      );
      expect(metadata).toEqual({
        token: expect.any(String),
        operation: 'build',
        pid: process.pid,
        startedAt: expect.any(Number),
      });
      expect(readdirSync(directory)).toEqual(['maintenance.lock']);
    });
    expect(readdirSync(directory)).toEqual([]);
  });

  it('removes a contender temporary file and preserves the original owner', async () => {
    await service.runExclusive('build', async () => {
      const original = readFileSync(
        join(directory, 'maintenance.lock'),
        'utf8',
      );
      await expect(
        service.runExclusive('restart', () => undefined),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(readFileSync(join(directory, 'maintenance.lock'), 'utf8')).toBe(
        original,
      );
      expect(readdirSync(directory)).toEqual(['maintenance.lock']);
    });
  });

  it('releases after rejected asynchronous work', async () => {
    const failure = new Error('build failed');
    await expect(
      service.runExclusive('build', () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(readdirSync(directory)).toEqual([]);
  });

  it('recovers a lock left by a process that has already crashed', async () => {
    writeFileSync(
      join(directory, 'maintenance.lock'),
      JSON.stringify({
        token: 'dead',
        operation: 'build',
        pid: 2_147_483_647,
        startedAt: Date.now(),
      }),
    );
    await expect(
      service.runExclusive('restart', () => 'recovered'),
    ).resolves.toBe('recovered');
  });

  it('refuses maintenance without Redis when distributed exclusion is required', async () => {
    const required = new FilesystemAdminMaintenanceLockService({
      get: (key: string) =>
        key === 'ADMIN_MAINTENANCE_LOCK_PATH'
          ? join(directory, 'required.lock')
          : key === 'ADMIN_MAINTENANCE_REQUIRE_DISTRIBUTED'
            ? true
            : undefined,
    } as never);
    await expect(
      required.runExclusive('build', () => undefined),
    ).rejects.toThrow('maintenance distribuée nécessite Redis');
  });

  it('requires a distributed lease in production even if the optional flag is false', async () => {
    const run = jest.fn();
    const production = new FilesystemAdminMaintenanceLockService({
      get: (key: string) =>
        key === 'NODE_ENV'
          ? 'production'
          : key === 'ADMIN_MAINTENANCE_LOCK_PATH'
            ? join(directory, 'production.lock')
            : false,
    } as never);
    await expect(production.runExclusive('build', run)).rejects.toThrow(
      'Redis',
    );
    expect(run).not.toHaveBeenCalled();
    expect(readdirSync(directory)).toEqual([]);
  });

  it('never evicts a live local owner merely because its operation exceeds the lease TTL', async () => {
    writeFileSync(
      join(directory, 'maintenance.lock'),
      JSON.stringify({
        token: 'live',
        pid: process.pid,
        startedAt: Date.now() - 60 * 60 * 1000,
      }),
    );
    const run = jest.fn();
    await expect(service.runExclusive('build', run)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('excludes different maintenance operations across independent local directories', async () => {
    let held = false;
    const acquire = jest.fn(async (_key: string, _ttl: number) => {
      if (held) return null;
      held = true;
      return {
        isHeld: async () => held,
        release: async () => {
          held = false;
        },
      };
    });
    const instance = (name: string) =>
      new FilesystemAdminMaintenanceLockService(
        {
          get: (key: string) =>
            key === 'ADMIN_MAINTENANCE_LOCK_PATH'
              ? join(directory, name)
              : undefined,
        } as never,
        { acquire } as never,
      );
    const second = instance('second.lock');
    const run = jest.fn();
    await instance('first.lock').runExclusive('build', async () => {
      await expect(
        second.runExclusive('migrations', run),
      ).rejects.toBeInstanceOf(ConflictException);
    });
    expect(run).not.toHaveBeenCalled();
    await second.runExclusive('migrations', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(new Set(acquire.mock.calls.map((args) => args[0]))).toEqual(
      new Set(['lemonde:admin:maintenance']),
    );
    expect(readdirSync(directory)).toEqual([]);
  });
});
