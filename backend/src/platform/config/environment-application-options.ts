import * as Joi from 'joi';

const buildLabel = Joi.string()
  .pattern(/^[A-Za-z0-9._/+:-]{1,128}$/)
  .allow('')
  .optional();

export const applicationEnvironment = {
  ADMIN_MAINTENANCE_BACKEND_SERVICE: Joi.string()
    .pattern(/^[a-zA-Z0-9][a-zA-Z0-9@._-]{0,199}$/)
    .default('lila-backend.service'),
  ADMIN_MAINTENANCE_DEPLOY_UNIT: Joi.string()
    .pattern(/^[a-zA-Z0-9][a-zA-Z0-9@._-]{0,199}$/)
    .default('lila-backend-deploy.service'),
  BOT_NAMES_CACHE_TTL_MS: Joi.number()
    .integer()
    .min(0)
    .max(86400000)
    .default(30000),
  GAME_CATALOG_CACHE_TTL_MS: Joi.number()
    .integer()
    .min(0)
    .max(86400000)
    .default(30000),
  CLIENT_WX_MANIFEST_CACHE_TTL_MS: Joi.number()
    .integer()
    .min(0)
    .max(86400000)
    .default(5000),
  PRESENCE_CHAT_BAN_CACHE_TTL_MS: Joi.number()
    .integer()
    .positive()
    .max(86400000)
    .default(10000),
  PRESENCE_ORIGINS_CACHE_TTL_MS: Joi.number()
    .integer()
    .positive()
    .max(86400000)
    .default(120000),
  PROFILE_BIO_MIN_LENGTH: Joi.number().integer().min(0).max(10000).default(0),
  PROFILE_BIO_MAX_LENGTH: Joi.number()
    .integer()
    .min(Joi.ref('PROFILE_BIO_MIN_LENGTH'))
    .max(10000)
    .default(500),
  ROOM_AUTO_CLEANUP_ENABLED: Joi.boolean()
    .truthy('true', '1', 'yes', 'y')
    .falsy('false', '0', 'no', 'n')
    .default(false),
  ROOM_AUTO_CLEANUP_INTERVAL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(86400)
    .default(300),
  ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(525600)
    .default(60),
  ROOM_AUTO_CLEANUP_LIMIT: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(1000),
  ROOM_PAYLOAD_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(3600)
    .default(15),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .optional(),
  PROGRAMDATA: Joi.string().max(4096).optional(),
  COMMIT_SHA: buildLabel,
  GITHUB_SHA: buildLabel,
  LEMONDEDELILA_BUILD_ID: buildLabel,
  LEMONDEDELILA_GIT_SHA: buildLabel,
  SOURCE_VERSION: buildLabel,
};
