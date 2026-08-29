import { DataSource } from 'typeorm';
import { ORM_ENTITIES } from './database/entities';
import {
  getProcessEnvironment,
  readEnvironment,
  readEnvironmentBoolean,
} from './config/public-api';

const shouldIgnoreEnvFile = readEnvironmentBoolean('IGNORE_ENV_FILE', false);
if (!shouldIgnoreEnvFile) {
  // Load `.env` for migrations as well (default behavior).
  // When env vars come from systemd/docker, set `IGNORE_ENV_FILE=true`.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config');
}

const {
  DATABASE_URL,
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'le_monde_de_lila',
} = getProcessEnvironment();

const isProd = readEnvironment('NODE_ENV') === 'production';
const base = DATABASE_URL
  ? {
      type: 'mysql' as const,
      url: DATABASE_URL,
    }
  : {
      type: 'mysql' as const,
      host: DB_HOST,
      port: parseInt(DB_PORT, 10),
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    };

const migrations = [isProd ? 'dist/migrations/*.js' : 'src/migrations/*.ts'];

export default new DataSource({
  ...base,
  entities: ORM_ENTITIES,
  migrations,
  synchronize: false,
  logging: false,
});
