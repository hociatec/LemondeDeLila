import {
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  closeSync,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { operationalSettings } from '../../../../platform/config/public-api';
import type { AdminMaintenanceLock } from '../../application/ports/admin-maintenance-lock.port';
import {
  RedisDistributedLeaseService,
  type RedisDistributedLease,
} from '../../../../platform/redis/public-api';

@Injectable()
export class FilesystemAdminMaintenanceLockService implements AdminMaintenanceLock {
  private static readonly MAX_LOCK_BYTES = 4096;
  private readonly logger = new Logger(
    FilesystemAdminMaintenanceLockService.name,
  );
  private readonly lockPath: string;
  private readonly requireDistributed: boolean;

  constructor(
    config: ConfigService,
    @Optional()
    private readonly distributedLeases?: RedisDistributedLeaseService,
  ) {
    this.lockPath =
      config.get<string>('ADMIN_MAINTENANCE_LOCK_PATH') ??
      '/tmp/lila-admin-maintenance.lock';
    this.requireDistributed =
      config.get<string>('NODE_ENV') === 'production' ||
      config.get<boolean>('ADMIN_MAINTENANCE_REQUIRE_DISTRIBUTED') === true;
  }

  async runExclusive<TResult>(
    operation: string,
    run: () => TResult | Promise<TResult>,
  ): Promise<Awaited<TResult>> {
    const lease: RedisDistributedLease | null = this.distributedLeases
      ? await this.distributedLeases.acquire(
          'lemonde:admin:maintenance',
          operationalSettings.maintenanceLeaseMs,
        )
      : null;
    if (this.distributedLeases && !lease) {
      throw new ConflictException('Une maintenance est deja en cours.');
    }
    if (this.requireDistributed && !lease) {
      throw new ConflictException(
        'La maintenance distribuée nécessite Redis opérationnel.',
      );
    }
    const token = randomUUID();
    try {
      this.acquireLock(token, operation);
    } catch (error) {
      await lease?.release();
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new ConflictException(
          'Une opération de maintenance incompatible est déjà en cours.',
        );
      }
      throw error;
    }
    this.logger.log(
      JSON.stringify({ event: 'admin.maintenance.started', operation }),
    );
    let released = false;
    let leaseReleased = false;
    const release = async () => {
      if (released) return;
      released = true;
      try {
        this.releaseOwnedLock(token);
      } finally {
        if (!leaseReleased) {
          leaseReleased = true;
          await lease?.release();
        }
        this.logger.log(
          JSON.stringify({ event: 'admin.maintenance.finished', operation }),
        );
      }
    };
    try {
      if (lease && !(await lease.isHeld())) {
        throw new ConflictException('Bail de maintenance perdu.');
      }
      const result = await run();
      if (lease && !(await lease.isHeld())) {
        throw new ConflictException('Bail de maintenance perdu.');
      }
      return result;
    } finally {
      await release();
    }
  }

  private acquireLock(token: string, operation: string): void {
    this.removeStaleLock();
    const temporaryPath = `${this.lockPath}.${token}.tmp`;
    const descriptor = openSync(temporaryPath, 'wx', 0o600);
    try {
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
      fsyncSync(descriptor);
      // Atomic publication with no replacement: contenders never see partial JSON.
      linkSync(temporaryPath, this.lockPath);
    } finally {
      try {
        closeSync(descriptor);
      } finally {
        unlinkSync(temporaryPath);
      }
    }
  }

  private releaseOwnedLock(token: string): void {
    try {
      const stat = statSync(this.lockPath);
      if (
        !stat.isFile() ||
        stat.size > FilesystemAdminMaintenanceLockService.MAX_LOCK_BYTES
      ) {
        throw new Error('Verrou de maintenance invalide ou trop volumineux');
      }
      const parsed: unknown = JSON.parse(readFileSync(this.lockPath, 'utf8'));
      if (isRecord(parsed) && parsed.token === token) {
        unlinkSync(this.lockPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  private removeStaleLock(): boolean {
    try {
      const stat = statSync(this.lockPath);
      if (
        !stat.isFile() ||
        stat.size > FilesystemAdminMaintenanceLockService.MAX_LOCK_BYTES
      ) {
        return false;
      }
      const parsed: unknown = JSON.parse(readFileSync(this.lockPath, 'utf8'));
      if (
        !isRecord(parsed) ||
        typeof parsed.startedAt !== 'number' ||
        !Number.isFinite(parsed.startedAt) ||
        !this.isProcessGone(parsed.pid)
      ) {
        return false;
      }
      unlinkSync(this.lockPath);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT';
    }
  }

  private isProcessGone(value: unknown): boolean {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
      return true;
    const pid = value;
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
