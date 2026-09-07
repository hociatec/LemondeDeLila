export type RuntimeEnvironmentKey =
  | 'ADMIN_MAINTENANCE_ALLOWED_IPS'
  | 'ADMIN_MAINTENANCE_ENABLED'
  | 'ADMIN_MAINTENANCE_REQUIRE_TOKEN'
  | 'ADMIN_MAINTENANCE_TOKEN'
  | 'CLIENT_FORCE_LATEST'
  | 'CLIENT_MIN_VERSION'
  | 'CLIENT_UPDATE_DISCONNECT_DELAY_MS'
  | 'CLIENT_WX_ALLOW_UNSIGNED'
  | 'CLIENT_WX_MAX_ARTIFACT_BYTES'
  | 'CLIENT_WX_MIN_VERSION'
  | 'CLIENT_WX_UPDATES_UPLOAD_TOKEN'
  | 'CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64'
  | 'CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH'
  | 'CLIENT_WX_SIGNATURE_PUBLIC_KEY_PEM'
  | 'CLIENT_WX_UPDATES_DIR'
  | 'CLIENT_WX_UPDATES_META_PATH'
  | 'CLIENT_WX_UPDATES_PUBLIC_URL'
  | 'CLIENT_WX_STORAGE_QUOTA_BYTES'
  | 'COMMIT_SHA'
  | 'DATABASE_URL'
  | 'DB_HOST'
  | 'DB_NAME'
  | 'DB_PASSWORD'
  | 'DB_PORT'
  | 'DB_USER'
  | 'GAME_DEVTOOLS_ENABLED'
  | 'GAME_MODULES_ROOT'
  | 'GITHUB_SHA'
  | 'IGNORE_ENV_FILE'
  | 'JWT_ALGORITHM'
  | 'JWT_AUDIENCE'
  | 'JWT_CLOCK_TOLERANCE_SECONDS'
  | 'JWT_ISSUER'
  | 'JWT_PRIVATE_KEY_PATH'
  | 'JWT_PRIVATE_KEY_PEM'
  | 'JWT_PUBLIC_KEY_PATH'
  | 'JWT_PUBLIC_KEY_PEM'
  | 'LEMONDEDELILA_BUILD_ID'
  | 'LEMONDEDELILA_GIT_SHA'
  | 'LMDL_SOUNDS_DIR'
  | 'LOG_DIR'
  | 'LOG_FILES_ENABLED'
  | 'LOG_LEVEL'
  | 'MAINTENANCE_COMMAND_TIMEOUT_MS'
  | 'MNEMO_QUIZ_PATH'
  | 'NODE_ENV'
  | 'PROGRAMDATA'
  | 'ROOM_CLEANUP_INITIAL_DELAY_MS'
  | 'ROOM_CLEANUP_TICK_MS'
  | 'ROOM_INVITE_TTL_MS'
  | 'SOUND_PROBE_TIMEOUT_MS'
  | 'SOUND_TRANSCODE_TIMEOUT_MS'
  | 'SOUNDS_STORAGE_QUOTA_BYTES'
  | 'STORAGE_MIN_FREE_BYTES'
  | 'SOURCE_VERSION'
  | 'WS_PERMESSAGE_DEFLATE'
  | 'WS_RECONNECT_BACKOFF_MS';

export function readEnvironment(
  key: RuntimeEnvironmentKey,
  fallback = '',
): string {
  return process.env[key] ?? fallback;
}

export function readEnvironmentBoolean(
  key: RuntimeEnvironmentKey,
  fallback: boolean,
): boolean {
  const value = readEnvironment(key).trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes';
}

export function getProcessEnvironment(): NodeJS.ProcessEnv {
  return process.env;
}
