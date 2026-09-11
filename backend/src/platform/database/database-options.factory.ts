import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  createMysqlConnectionOptions,
  databaseInteger,
} from './mysql-connection-options';

type TypeOrmEntities = NonNullable<TypeOrmModuleOptions['entities']>;

export function createDatabaseOptions(
  config: ConfigService,
  entities: TypeOrmEntities,
): TypeOrmModuleOptions {
  const read = (name: string): unknown => config.get(name);
  return {
    ...createMysqlConnectionOptions(read),
    entities,
    retryAttempts: databaseInteger(read, 'DB_STARTUP_RETRY_ATTEMPTS', 5, 0, 10),
    retryDelay: databaseInteger(
      read,
      'DB_STARTUP_RETRY_DELAY_MS',
      1000,
      0,
      30000,
    ),
  };
}
