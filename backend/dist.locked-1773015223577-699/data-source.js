"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _typeorm = require("typeorm");
const _entities = require("./database/entities");
const shouldIgnoreEnvFile = (process.env.IGNORE_ENV_FILE || '').toLowerCase().trim() === 'true';
if (!shouldIgnoreEnvFile) {
    // Load `.env` for migrations as well (default behavior).
    // When env vars come from systemd/docker, set `IGNORE_ENV_FILE=true`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv/config');
}
const { DATABASE_URL, DB_HOST = '127.0.0.1', DB_PORT = '3306', DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'le_monde_de_lila' } = process.env;
const isProd = process.env.NODE_ENV === 'production';
const base = DATABASE_URL ? {
    type: 'mysql',
    url: DATABASE_URL
} : {
    type: 'mysql',
    host: DB_HOST,
    port: parseInt(DB_PORT, 10),
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
};
const migrations = [
    isProd ? 'dist/migrations/*.js' : 'src/migrations/*.ts'
];
const _default = new _typeorm.DataSource({
    ...base,
    entities: _entities.ORM_ENTITIES,
    migrations,
    synchronize: false,
    logging: false
});
