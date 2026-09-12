import type { DataSourceOptions } from 'typeorm';

type ReadDatabaseSetting = (name: string) => unknown;
type MysqlOptions = Extract<
  DataSourceOptions,
  { readonly type: 'mysql' | 'mariadb' }
>;

/** Identical connection parsing for Nest and the migration CLI. Never prints values. */
export function createMysqlConnectionOptions(
  read: ReadDatabaseSetting,
): MysqlOptions {
  const url = read('DATABASE_URL');
  if (typeof url === 'string' && url.trim() && url.trim().length > 4096) {
    throw new Error('Invalid database setting: DATABASE_URL');
  }
  return {
    type: 'mysql',
    supportBigNumbers: true,
    bigNumberStrings: true,
    ...(typeof url === 'string' && url.trim()
      ? { url: url.trim() }
      : {
          host: textSetting(read, 'DB_HOST', '127.0.0.1'),
          port: databaseInteger(read, 'DB_PORT', 3306, 1, 65535),
          username: textSetting(read, 'DB_USER', 'root'),
          password: textSetting(read, 'DB_PASSWORD', ''),
          database: textSetting(read, 'DB_NAME', 'le_monde_de_lila'),
        }),
    connectTimeout: databaseInteger(
      read,
      'DB_CONNECT_TIMEOUT_MS',
      10000,
      1,
      120000,
    ),
    maxQueryExecutionTime: databaseInteger(
      read,
      'DB_QUERY_TIMEOUT_MS',
      30000,
      100,
      120000,
    ),
    extra: {
      connectionLimit: databaseInteger(read, 'DB_POOL_SIZE', 10, 1, 1000),
    },
    synchronize: false,
    // MySQL commits DDL implicitly. Wrapping a migration in a transaction only
    // keeps data backfills and metadata locks alive for longer and gives a false
    // rollback guarantee. Each migration must therefore be restartable.
    migrationsTransactionMode: 'none',
    logging: false,
  };
}

export function databaseInteger(
  read: ReadDatabaseSetting,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = read(name);
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && /^\d+$/.test(raw)
        ? Number(raw)
        : NaN;
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Invalid database setting: ${name}`);
  return value;
}

function textSetting(
  read: ReadDatabaseSetting,
  name: string,
  fallback: string,
): string {
  const value = read(name);
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string')
    throw new Error(`Invalid database setting: ${name}`);
  const normalized = value.trim();
  if (normalized.length > 255) {
    throw new Error(`Invalid database setting: ${name}`);
  }
  return normalized;
}
