"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const entities_1 = require("./database/entities");
const shouldIgnoreEnvFile = (process.env.IGNORE_ENV_FILE || '').toLowerCase().trim() === 'true';
if (!shouldIgnoreEnvFile) {
    require('dotenv/config');
}
const { DATABASE_URL, DB_HOST = '127.0.0.1', DB_PORT = '3306', DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'le_monde_de_lila', } = process.env;
const isProd = process.env.NODE_ENV === 'production';
const base = DATABASE_URL
    ? {
        type: 'mysql',
        url: DATABASE_URL,
    }
    : {
        type: 'mysql',
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        username: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
    };
const migrations = [isProd ? 'dist/migrations/*.js' : 'src/migrations/*.ts'];
exports.default = new typeorm_1.DataSource({
    ...base,
    entities: entities_1.ORM_ENTITIES,
    migrations,
    synchronize: false,
    logging: false,
});
//# sourceMappingURL=data-source.js.map