import * as Joi from 'joi';

type EnvValidationInput = Record<string, unknown>;

const coreEnvironment = {
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  IGNORE_ENV_FILE: Joi.boolean().truthy('true').falsy('false').default(false),
};

const databaseEnvironment = {
  DATABASE_URL: Joi.string().uri().optional(),
  DB_HOST: Joi.string().default('127.0.0.1'),
  DB_PORT: Joi.number().default(3306),
  DB_USER: Joi.string().default('root'),
  DB_PASSWORD: Joi.string().allow('', null).default(''),
  DB_NAME: Joi.string().default('le_monde_de_lila'),
};

const authEnvironment = {
  JWT_ALGORITHM: Joi.string().valid('HS256', 'RS256').optional(),
  JWT_SECRET: Joi.string().min(32).optional(),
  JWT_PRIVATE_KEY_PEM: Joi.string().optional(),
  JWT_PUBLIC_KEY_PEM: Joi.string().optional(),
  JWT_PRIVATE_KEY_PATH: Joi.string().optional(),
  JWT_PUBLIC_KEY_PATH: Joi.string().optional(),
  JWT_ISSUER: Joi.string().default('le-monde-de-lila'),
  JWT_AUDIENCE: Joi.string().optional(),
  JWT_CLOCK_TOLERANCE_SECONDS: Joi.number().default(10),
  JWT_EXPIRES_IN: Joi.string().default('12h'),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(3600).default(2592000),
  BCRYPT_COST: Joi.number().integer().min(10).max(15).default(12),
};

const redisAndRateLimitEnvironment = {
  SESSION_STORE_REDIS_URL: Joi.string().uri().optional(),
  GAME_ENGINE_STATE_REDIS_URL: Joi.string().uri().optional(),
  GAME_TASK_REDIS_URL: Joi.string().uri().optional(),
  ROOM_PAYLOAD_REDIS_URL: Joi.string().uri().optional(),
  NOTIFICATION_REDIS_URL: Joi.string().uri().optional(),
  PRESENCE_REDIS_URL: Joi.string().uri().optional(),
  RATE_LIMIT_TTL: Joi.number().integer().positive().default(60),
  RATE_LIMIT_COUNT: Joi.number().integer().positive().default(120),
};

const runtimeEnvironment = {
  CORS_ORIGINS: Joi.string().optional(),
  LOG_LEVEL: Joi.string().default('info'),
  LOG_DIR: Joi.string().default('logs'),
  LOG_FILES_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  ENABLE_PROTOTYPE_GAMES: Joi.string().optional(),
  GAME_DEVTOOLS_ENABLED: Joi.string().valid('true', 'false').default('false'),
  GAME_ROOM_LOCK_TIMEOUT_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(30)
    .default(5),
  GAME_MODULES_ROOT: Joi.string().optional(),
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
  MAINTENANCE_COMMAND_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .default(600000),
  SOUND_PROBE_TIMEOUT_MS: Joi.number().integer().positive().default(15000),
  SOUND_TRANSCODE_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  CLIENT_UPDATE_DISCONNECT_DELAY_MS: Joi.number()
    .integer()
    .positive()
    .default(1200),
  ROOM_CLEANUP_TICK_MS: Joi.number().integer().positive().default(30000),
  ROOM_CLEANUP_INITIAL_DELAY_MS: Joi.number()
    .integer()
    .positive()
    .default(5000),
  ROOM_INVITE_TTL_MS: Joi.number().integer().positive().default(600000),
  WS_RECONNECT_BACKOFF_MS: Joi.number().integer().positive().default(300),
};

const updateEnvironment = {
  CLIENT_UPDATES_DIR: Joi.string().optional(),
  CLIENT_UPDATES_META_PATH: Joi.string().optional(),
  CLIENT_UPDATES_UPLOADS_DIR: Joi.string().optional(),
  CLIENT_UPDATES_PUBLIC_URL: Joi.string().uri().optional(),
  CLIENT_UPDATES_UPLOAD_TOKEN: Joi.string().optional(),
  CLIENT_UPDATES_STORAGE_QUOTA_BYTES: Joi.number()
    .integer()
    .positive()
    .optional(),
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

const websocketEnvironment = {
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
  WS_SHARED_SECRET: Joi.string().optional(),
  REALTIME_WS_SECRET: Joi.string().optional(),
};

export const environmentValidationSchema = Joi.object({
  ...coreEnvironment,
  ...databaseEnvironment,
  ...authEnvironment,
  ...redisAndRateLimitEnvironment,
  ...runtimeEnvironment,
  ...updateEnvironment,
  ...websocketEnvironment,
})
  .custom(validateCrossModuleEnvironment)
  .messages({ 'any.custom': '{{#message}}' });

export function shouldIgnoreEnvironmentFile(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (environment.IGNORE_ENV_FILE ?? '').trim().toLowerCase() === 'true';
}

function validateCrossModuleEnvironment(
  rawEnvironment: unknown,
  helpers: Joi.CustomHelpers,
): EnvValidationInput | Joi.ErrorReport {
  const environment = rawEnvironment as EnvValidationInput;
  if (
    normalizedString(environment['NODE_ENV'], 'DEVELOPMENT') === 'PRODUCTION'
  ) {
    const productionError = validateProductionEnvironment(environment, helpers);
    if (productionError) return productionError;
  }
  return validateJwtEnvironment(environment, helpers);
}

function validateProductionEnvironment(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): Joi.ErrorReport | null {
  if (!environment['SESSION_STORE_REDIS_URL']) {
    return customError(
      helpers,
      'SESSION_STORE_REDIS_URL est requis en production',
    );
  }
  if (!environment['GAME_ENGINE_STATE_REDIS_URL']) {
    return customError(
      helpers,
      'GAME_ENGINE_STATE_REDIS_URL est requis en production',
    );
  }
  if (environment['CLIENT_WX_ALLOW_UNSIGNED'] === '1') {
    return customError(
      helpers,
      'CLIENT_WX_ALLOW_UNSIGNED est interdit en production',
    );
  }
  if (
    !environment['CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64'] &&
    !environment['CLIENT_WX_SIGNATURE_PUBLIC_KEY_PEM'] &&
    !environment['CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH']
  ) {
    return customError(
      helpers,
      'Une clé publique CLIENT_WX_SIGNATURE_PUBLIC_KEY_* est requise en production',
    );
  }
  const publicUrl = environment['CLIENT_WX_UPDATES_PUBLIC_URL'];
  if (typeof publicUrl !== 'string' || !/^https:\/\//i.test(publicUrl)) {
    return customError(
      helpers,
      'CLIENT_WX_UPDATES_PUBLIC_URL doit être une URL HTTPS absolue en production',
    );
  }
  return null;
}

function validateJwtEnvironment(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): EnvValidationInput | Joi.ErrorReport {
  const configuredAlgorithm = normalizedString(environment['JWT_ALGORITHM']);
  const hasRsaMaterial = Boolean(
    environment['JWT_PRIVATE_KEY_PEM'] ||
    environment['JWT_PRIVATE_KEY_PATH'] ||
    environment['JWT_PUBLIC_KEY_PEM'] ||
    environment['JWT_PUBLIC_KEY_PATH'],
  );
  const algorithm =
    configuredAlgorithm === 'HS256' || configuredAlgorithm === 'RS256'
      ? configuredAlgorithm
      : hasRsaMaterial
        ? 'RS256'
        : 'HS256';
  if (algorithm === 'HS256') {
    return environment['JWT_SECRET']
      ? environment
      : customError(helpers, 'JWT_SECRET est requis en mode HS256');
  }
  if (
    !environment['JWT_PRIVATE_KEY_PEM'] &&
    !environment['JWT_PRIVATE_KEY_PATH']
  ) {
    return customError(
      helpers,
      'JWT_PRIVATE_KEY_PEM ou JWT_PRIVATE_KEY_PATH est requis en mode RS256',
    );
  }
  if (
    !environment['JWT_PUBLIC_KEY_PEM'] &&
    !environment['JWT_PUBLIC_KEY_PATH']
  ) {
    return customError(
      helpers,
      'JWT_PUBLIC_KEY_PEM ou JWT_PUBLIC_KEY_PATH est requis en mode RS256',
    );
  }
  return environment;
}

function normalizedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : fallback;
}

function customError(
  helpers: Joi.CustomHelpers,
  message: string,
): Joi.ErrorReport {
  return helpers.error('any.custom', { message });
}
