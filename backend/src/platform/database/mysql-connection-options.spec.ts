import { ConfigService } from '@nestjs/config';
import { createDatabaseOptions } from './database-options.factory';
import { createMysqlConnectionOptions } from './mysql-connection-options';

it('uses the same validated connection and pool settings in Nest and the migration CLI', () => {
  const values: Record<string, unknown> = {
    DB_PORT: '3307',
    DB_POOL_SIZE: '12',
    DB_CONNECT_TIMEOUT_MS: '4000',
    DB_QUERY_TIMEOUT_MS: '5000',
    DB_PASSWORD: 'test-secret',
  };
  const connection = createMysqlConnectionOptions((name) => values[name]);
  const options = createDatabaseOptions(new ConfigService(values), []);
  expect(options).toEqual({
    ...connection,
    entities: [],
    retryAttempts: 5,
    retryDelay: 1000,
  });
  expect(connection).toMatchObject({
    port: 3307,
    supportBigNumbers: true,
    bigNumberStrings: true,
    extra: { connectionLimit: 12 },
    connectTimeout: 4000,
    maxQueryExecutionTime: 5000,
    synchronize: false,
    logging: false,
  });
});

it('rejects malformed and out-of-range numbers without disclosing configured values', () => {
  for (const [name, value] of [
    ['DB_PORT', '3306secret'],
    ['DB_PORT', 65536],
    ['DB_POOL_SIZE', 0],
    ['DB_POOL_SIZE', Infinity],
    ['DB_CONNECT_TIMEOUT_MS', -1],
    ['DB_QUERY_TIMEOUT_MS', 99],
  ]) {
    const read = (key: string) => (key === name ? value : undefined);
    expect(() => createMysqlConnectionOptions(read)).toThrow(
      `Invalid database setting: ${name}`,
    );
  }
  expect(
    createMysqlConnectionOptions((name) =>
      name === 'DATABASE_URL' ? 'mysql://example/test' : undefined,
    ),
  ).toMatchObject({ url: 'mysql://example/test' });
});
