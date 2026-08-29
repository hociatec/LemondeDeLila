export const ADMIN_MAINTENANCE_LOCK = Symbol('ADMIN_MAINTENANCE_LOCK');

export interface AdminMaintenanceLock {
  runExclusive<TResult>(operation: string, run: () => TResult): TResult;
}
