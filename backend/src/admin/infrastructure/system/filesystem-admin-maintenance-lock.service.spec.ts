import { ConflictException } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
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

  it('rejects a concurrent incompatible operation and releases afterward', () => {
    service.runExclusive('build', () => {
      expect(() => service.runExclusive('migrations', () => undefined)).toThrow(
        ConflictException,
      );
    });
    expect(() =>
      service.runExclusive('migrations', () => undefined),
    ).not.toThrow();
  });

  it('keeps the lock until an asynchronous operation settles', async () => {
    let finish!: () => void;
    const pending = service.runExclusive(
      'build',
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    expect(() => service.runExclusive('restart', () => undefined)).toThrow(
      ConflictException,
    );
    finish();
    await pending;
    expect(() =>
      service.runExclusive('restart', () => undefined),
    ).not.toThrow();
  });
});
