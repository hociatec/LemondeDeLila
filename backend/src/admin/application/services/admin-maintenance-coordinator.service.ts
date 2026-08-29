import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_LOCK,
  type AdminMaintenanceLock,
} from '../ports/admin-maintenance-lock.port';

@Injectable()
export class AdminMaintenanceCoordinatorService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_LOCK)
    private readonly lock: AdminMaintenanceLock,
  ) {}

  execute<TResult>(operation: string, run: () => TResult): TResult {
    return this.lock.runExclusive(operation, run);
  }
}
