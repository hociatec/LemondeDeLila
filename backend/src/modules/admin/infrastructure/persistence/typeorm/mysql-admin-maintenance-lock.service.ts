import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { AdminMaintenanceLock } from '../../../application/ports/admin-maintenance-lock.port';
import { FilesystemAdminMaintenanceLockService } from '../../system/filesystem-admin-maintenance-lock.service';
import { AdminMaintenanceOwnership } from '../../system/admin-maintenance-ownership';

/** Durable exclusion: a paused/crashed owner is never replaced on a TTL. */
@Injectable()
export class MysqlAdminMaintenanceLockService implements AdminMaintenanceLock {
  constructor(
    private readonly database: DataSource,
    private readonly local: FilesystemAdminMaintenanceLockService,
    private readonly ownership: AdminMaintenanceOwnership = new AdminMaintenanceOwnership(),
  ) {}

  async runExclusive<TResult>(
    operation: string,
    run: () => TResult | Promise<TResult>,
  ): Promise<Awaited<TResult>> {
    const token = randomUUID();
    const owner = { token, detached: false };
    try {
      await this.database.query(
        'INSERT INTO admin_maintenance_locks (lock_name, owner_token, operation) VALUES (?, ?, ?)',
        ['global', token, operation],
      );
    } catch (error) {
      if (duplicateKey(error))
        throw new ConflictException('Une maintenance est deja en cours.');
      // An uncertain INSERT may have committed. Never proceed or steal its row.
      throw error;
    }
    try {
      return await this.ownership.run(owner, () =>
        this.local.runExclusive(operation, run),
      );
    } finally {
      // Completion, not a Redis TTL or a connection lifetime, releases ownership.
      if (!owner.detached)
        await this.database.query(
          'DELETE FROM admin_maintenance_locks WHERE lock_name = ? AND owner_token = ?',
          ['global', token],
        );
    }
  }
}

function duplicateKey(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && error.code === 'ER_DUP_ENTRY') return true;
  return 'driverError' in error && duplicateKey(error.driverError);
}
