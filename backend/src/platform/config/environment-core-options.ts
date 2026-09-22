import * as Joi from 'joi';

export const coreEnvironment = {
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  IGNORE_ENV_FILE: Joi.boolean().truthy('true').falsy('false').default(false),
};

export const databaseEnvironment = {
  DATABASE_URL: Joi.string().uri().optional(),
  DB_HOST: Joi.string().default('127.0.0.1'),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(1000).default(10),
  DB_CONNECT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1)
    .max(120000)
    .default(10000),
  DB_QUERY_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(120000)
    .default(30000),
  DB_STARTUP_RETRY_ATTEMPTS: Joi.number().integer().min(0).max(10).default(5),
  DB_STARTUP_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .max(30000)
    .default(1000),
  DB_USER: Joi.string().default('root'),
  DB_PASSWORD: Joi.string().allow('', null).default(''),
  DB_NAME: Joi.string().default('le_monde_de_lila'),
};

export const authEnvironment = {
  JWT_ALGORITHM: Joi.string().valid('RS256').default('RS256'),
  JWT_PRIVATE_KEY_PEM: Joi.string().optional(),
  JWT_PUBLIC_KEY_PEM: Joi.string().optional(),
  JWT_PRIVATE_KEY_PATH: Joi.string().optional(),
  JWT_PUBLIC_KEY_PATH: Joi.string().optional(),
  JWT_ISSUER: Joi.string().default('le-monde-de-lila'),
  JWT_AUDIENCE: Joi.string().optional(),
  JWT_CLOCK_TOLERANCE_SECONDS: Joi.number()
    .integer()
    .min(0)
    .max(300)
    .default(10),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^[1-9]\d{0,5}(s|m|h|d)$/)
    .default('12h'),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(3600).default(2592000),
  BCRYPT_COST: Joi.number().integer().min(10).max(15).default(12),
};

export const redisAndRateLimitEnvironment = {
  SESSION_STORE_REDIS_URL: Joi.string().uri().optional(),
  UPDATE_REDIS_URL: Joi.string().uri().optional(),
  GAME_ENGINE_STATE_REDIS_URL: Joi.string().uri().optional(),
  GAME_TASK_REDIS_URL: Joi.string().uri().optional(),
  ROOM_PAYLOAD_REDIS_URL: Joi.string().uri().optional(),
  NOTIFICATION_REDIS_URL: Joi.string().uri().optional(),
  PRESENCE_REDIS_URL: Joi.string().uri().optional(),
  RATE_LIMIT_REDIS_URL: Joi.string().uri().optional(),
  RATE_LIMIT_TTL: Joi.number().integer().positive().default(60),
  RATE_LIMIT_COUNT: Joi.number().integer().positive().default(120),
};

export const runtimeEnvironment = {
  TRUSTED_PROXY_CIDRS: Joi.string().optional(),
  CORS_ORIGINS: Joi.string().optional(),
  LOG_LEVEL: Joi.string().default('info'),
  LOG_DIR: Joi.string().default('logs'),
  LOG_FILES_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OTEL_SDK_DISABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTEL_SERVICE_NAME: Joi.string().min(1).default('le-monde-de-lila-backend'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: Joi.string().uri().optional(),
  OPENAPI_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),
  HEALTH_CHECK_PATH: Joi.string().optional(),
  HEALTH_MIN_FREE_BYTES: Joi.number().integer().min(0).default(104857600),
  HEALTH_MAX_EVENT_LOOP_LAG_MS: Joi.number().positive().default(250),
  HEALTH_MAX_FAILED_JOBS: Joi.number().integer().min(0).default(100),
  ENABLE_PROTOTYPE_GAMES: Joi.string().optional(),
  GAME_DEVTOOLS_ENABLED: Joi.string().valid('true', 'false').default('false'),
  GAME_ROOM_LOCK_TIMEOUT_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(30)
    .default(5),
  GAME_MODULES_ROOT: Joi.string().optional(),
  LILA_CONTENT_RELEASE_DIR: Joi.string().optional(),
  WS_PERMESSAGE_DEFLATE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  LMDL_SOUNDS_DIR: Joi.string().optional(),
  MNEMO_QUIZ_PATH: Joi.string().optional(),
  ADMIN_MAINTENANCE_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  ADMIN_MAINTENANCE_REQUIRE_TOKEN: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  ADMIN_MAINTENANCE_TOKEN: Joi.string().optional(),
  ADMIN_MAINTENANCE_ALLOWED_IPS: Joi.string().optional(),
  ADMIN_MAINTENANCE_LOCK_PATH: Joi.string().min(1).optional(),
  ADMIN_MAINTENANCE_REQUIRE_DISTRIBUTED: Joi.boolean().default(false),
};

export const updateEnvironment = {
  CLIENT_WX_UPDATES_UPLOAD_TOKEN: Joi.string().optional(),
  CLIENT_MIN_VERSION: Joi.string().optional(),
  CLIENT_FORCE_LATEST: Joi.boolean()
    .truthy('true', '1')
    .falsy('false', '0')
    .default(false),
  CLIENT_WX_UPDATES_DIR: Joi.string().optional(),
  CLIENT_WX_UPDATES_META_PATH: Joi.string().optional(),
  CLIENT_WX_UPDATES_PUBLIC_URL: Joi.string().uri().optional(),
  CLIENT_WX_MIN_VERSION: Joi.string().optional(),
  CLIENT_WX_MAX_ARTIFACT_BYTES: Joi.number().integer().positive().optional(),
  CLIENT_WX_STORAGE_QUOTA_BYTES: Joi.number().integer().positive().optional(),
  SOUNDS_STORAGE_QUOTA_BYTES: Joi.number().integer().positive().optional(),
  STORAGE_MIN_FREE_BYTES: Joi.number().integer().min(0).optional(),
  CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64: Joi.string().optional(),
  CLIENT_WX_SIGNATURE_PUBLIC_KEY_PEM: Joi.string().optional(),
  CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH: Joi.string().optional(),
  CLIENT_WX_ALLOW_UNSIGNED: Joi.string().valid('0', '1').default('0'),
  TAVERNE_CATEGORIES_ROOT: Joi.string().optional(),
};

export const websocketEnvironment = {
  WS_TICKET_SECRET: Joi.string().min(32).required(),
  WS_TICKET_TTL_SECONDS: Joi.number().integer().positive().default(60),
  WS_MAX_BUFFERED_BYTES: Joi.number().integer().min(65536).default(1048576),
  WS_MAX_PAYLOAD_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(1048576)
    .default(65536),
  WS_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(10000),
  WS_RATE_LIMIT_COUNT: Joi.number().integer().min(1).default(60),
};
