import { databasePoolSaturation } from './database-pool-saturation';

function driver(total: unknown, free: unknown, limit?: unknown) {
  return {
    pool: {
      _allConnections: { length: total },
      _freeConnections: { length: free },
      config: { connectionLimit: limit },
    },
  };
}

it('reads supported pool counters with bounded saturation', () => {
  expect(databasePoolSaturation(driver(4, 2, 10))).toBe(0.2);
  expect(databasePoolSaturation(driver(4, 2))).toBe(0.5);
  expect(databasePoolSaturation(driver(0, 0, 0))).toBe(0);
  expect(databasePoolSaturation(driver(4, 0, 2))).toBe(1);
});

it.each([
  null,
  {},
  { pool: [] },
  driver('4', 2, 10),
  driver(4, -1, 10),
  driver(4, 5, 10),
  driver(4, 2, NaN),
  driver(Infinity, 2, 10),
  driver(4, 2, 0.5),
])('ignores unavailable or invalid diagnostic internals: %j', (value) => {
  expect(databasePoolSaturation(value)).toBeNull();
});
