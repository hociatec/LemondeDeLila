import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

type TypeOrmEntities = NonNullable<TypeOrmModuleOptions['entities']>;

export function createDatabaseOptions(
  config: ConfigService,
  entities: TypeOrmEntities,
): TypeOrmModuleOptions {
  const url = config.get<string>('DATABASE_URL');
  const connection = url
    ? { url }
    : {
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'le_monde_de_lila'),
      };
  return {
    type: 'mysql',
    entities,
    synchronize: false,
    logging: false,
    ...connection,
  };
}
