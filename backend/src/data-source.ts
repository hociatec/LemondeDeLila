import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ORM_ENTITIES } from './app/database/typeorm-entities';
import {
  createMysqlConnectionOptions,
  MigrationDataSource,
} from './platform/database/public-api';
import {
  getProcessEnvironment,
  readEnvironmentBoolean,
} from './platform/config/public-api';

const shouldIgnoreEnvFile = readEnvironmentBoolean('IGNORE_ENV_FILE', false);
if (!shouldIgnoreEnvFile) {
  // Load `.env` for migrations as well (default behavior).
  // When env vars come from systemd/docker, set `IGNORE_ENV_FILE=true`.
  // Keep this side effect conditional: IGNORE_ENV_FILE must be checked first.
  createRequire(__filename)('dotenv/config');
}

const environment = getProcessEnvironment();
const base = createMysqlConnectionOptions((name) => environment[name]);

const migrationExtension = __filename.endsWith('.js') ? 'js' : 'ts';
const migrations = [
  join(
    __dirname,
    `platform/database/migrations/[0-9]*-*.${migrationExtension}`,
  ),
];

export default new MigrationDataSource({
  ...base,
  entities: ORM_ENTITIES,
  migrations,
  synchronize: false,
  logging: false,
});
