import * as Joi from 'joi';

export const operationalEnvironment = {
  MAINTENANCE_COMMAND_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .default(600000),
  SOUND_PROBE_TIMEOUT_MS: Joi.number().integer().positive().default(15000),
  SOUND_PROCESS_QUEUE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1)
    .max(120000)
    .default(15000),
  NOTIFICATION_DEDUPLICATION_TTL_MS: Joi.number()
    .integer()
    .min(1)
    .max(31536000000)
    .default(300000),
  CLIENT_WX_UPLOAD_RETENTION_MS: Joi.number()
    .integer()
    .min(1)
    .max(31536000000)
    .default(86400000),
  CLIENT_WX_COMPLETION_LEASE_MS: Joi.number()
    .integer()
    .min(5000)
    .max(86400000)
    .default(900000),
  CLIENT_WX_PUBLICATION_LEASE_MS: Joi.number()
    .integer()
    .min(5000)
    .max(86400000)
    .default(900000),
  CLIENT_WX_PUBLICATION_LOCK_STALE_MS: Joi.number()
    .integer()
    .min(1)
    .max(31536000000)
    .default(7200000),
  ADMIN_MAINTENANCE_LEASE_MS: Joi.number()
    .integer()
    .min(5000)
    .max(86400000)
    .default(900000),
  SESSION_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(31536000)
    .default(86400),
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
  REALTIME_REQUEST_REPLAY_TTL_MS: Joi.number().integer().positive().optional(),
  AUTH_REQUEST_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(3_600_000)
    .optional(),
  AUTH_REQUEST_RATE_LIMIT_COUNT: Joi.number()
    .integer()
    .min(1)
    .max(10_000)
    .optional(),
  REALTIME_REQUEST_REPLAY_MAX_ENTRIES: Joi.number()
    .integer()
    .positive()
    .optional(),
};
