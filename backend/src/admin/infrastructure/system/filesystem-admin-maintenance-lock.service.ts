import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  closeSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AdminMaintenanceLock } from '../../application/ports/admin-maintenance-lock.port';

@Injectable()
export class FilesystemAdminMaintenanceLockService implements AdminMaintenanceLock {
  private readonly logger = new Logger(
    FilesystemAdminMaintenanceLockService.name,
  );
  private readonly lockPath: string;

  constructor(config: ConfigService) {
    this.lockPath =
      config.get<string>('ADMIN_MAINTENANCE_LOCK_PATH') ??
      '/tmp/lila-admin-maintenance.lock';
  }

  runExclusive<TResult>(operation: string, run: () => TResult): TResult {
    const token = randomUUID();
    let descriptor: number;
    try {
      descriptor = openSync(this.lockPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new ConflictException(
          'Une opération de maintenance incompatible est déjà en cours.',
        );
      }
      throw error;
    }
    writeFileSync(
      descriptor,
      JSON.stringify({
        token,
        operation,
        pid: process.pid,
        startedAt: Date.now(),
      }),
      'utf8',
    );
    this.logger.log(
      JSON.stringify({ event: 'admin.maintenance.started', operation }),
    );
    const release = () => {
      closeSync(descriptor);
      this.releaseOwnedLock(token);
      this.logger.log(
        JSON.stringify({ event: 'admin.maintenance.finished', operation }),
      );
    };
    try {
      const result = run();
      if (this.isPromiseLike(result)) {
        return result.finally(release) as TResult;
      }
      release();
      return result;
    } catch (error) {
      release();
      throw error;
    }
  }

  private isPromiseLike<TValue>(
    value: TValue,
  ): value is TValue & Promise<Awaited<TValue>> {
    return (
      value != null &&
      typeof value === 'object' &&
      'then' in value &&
      typeof value.then === 'function'
    );
  }

  private releaseOwnedLock(token: string): void {
    try {
      const current = JSON.parse(readFileSync(this.lockPath, 'utf8')) as {
        token?: unknown;
      };
      if (current.token === token) unlinkSync(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
