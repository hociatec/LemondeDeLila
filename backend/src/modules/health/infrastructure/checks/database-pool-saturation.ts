/** mysql pool internals are optional diagnostics, never a readiness requirement. */
export function databasePoolSaturation(driver: unknown): number | null {
  const pool = property(driver, 'pool');
  const total = count(property(property(pool, '_allConnections'), 'length'));
  const free = count(property(property(pool, '_freeConnections'), 'length'));
  const configuredLimit = property(property(pool, 'config'), 'connectionLimit');
  const limit = configuredLimit === undefined ? total : count(configuredLimit);
  if (total === null || free === null || limit === null || free > total) {
    return null;
  }
  return limit > 0 ? Math.min(1, (total - free) / limit) : 0;
}

function property(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return Reflect.get(value, key);
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
