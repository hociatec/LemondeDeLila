import {
  readEnvironment,
  type RuntimeEnvironmentKey,
} from './runtime-environment';

function positiveInteger(
  key: RuntimeEnvironmentKey,
  fallback: number,
  max = 31_536_000_000,
): number {
  const value = Number(readEnvironment(key));
  return Number.isSafeInteger(value) && value > 0 && value <= max
    ? value
    : fallback;
}

function nonNegativeInteger(
  key: RuntimeEnvironmentKey,
  fallback: number,
): number {
  const value = Number(readEnvironment(key));
  return Number.isSafeInteger(value) && value >= 0 && value <= 31_536_000_000
    ? value
    : fallback;
}

/** Central operational timings; every value can be overridden by environment. */
export const operationalSettings = Object.freeze({
  catalogCacheTtlMs: nonNegativeInteger('GAME_CATALOG_CACHE_TTL_MS', 30_000),
  botNamesCacheTtlMs: nonNegativeInteger('BOT_NAMES_CACHE_TTL_MS', 30_000),
  clientWxManifestCacheTtlMs: nonNegativeInteger(
    'CLIENT_WX_MANIFEST_CACHE_TTL_MS',
    5_000,
  ),
  presenceChatBanCacheTtlMs: positiveInteger(
    'PRESENCE_CHAT_BAN_CACHE_TTL_MS',
    10_000,
  ),
  presenceOriginsCacheTtlMs: positiveInteger(
    'PRESENCE_ORIGINS_CACHE_TTL_MS',
    120_000,
  ),
  maintenanceCommandTimeoutMs: positiveInteger(
    'MAINTENANCE_COMMAND_TIMEOUT_MS',
    600_000,
  ),
  soundProbeTimeoutMs: positiveInteger('SOUND_PROBE_TIMEOUT_MS', 15_000),
  soundTranscodeTimeoutMs: positiveInteger(
    'SOUND_TRANSCODE_TIMEOUT_MS',
    30_000,
  ),
  clientUpdateDisconnectDelayMs: positiveInteger(
    'CLIENT_UPDATE_DISCONNECT_DELAY_MS',
    1_200,
  ),
  roomCleanupTickMs: positiveInteger('ROOM_CLEANUP_TICK_MS', 30_000),
  roomCleanupInitialDelayMs: positiveInteger(
    'ROOM_CLEANUP_INITIAL_DELAY_MS',
    5_000,
  ),
  roomInviteTtlMs: positiveInteger('ROOM_INVITE_TTL_MS', 600_000),
  refreshTokenTtlSeconds: positiveInteger(
    'REFRESH_TOKEN_TTL_SECONDS',
    2_592_000,
    31_536_000,
  ),
  roomPayloadCacheTtlSeconds: positiveInteger(
    'ROOM_PAYLOAD_CACHE_TTL_SECONDS',
    15,
  ),
  realtimeRequestReplayTtlMs: positiveInteger(
    'REALTIME_REQUEST_REPLAY_TTL_MS',
    5 * 60_000,
  ),
  realtimeRequestReplayMaxEntries: positiveInteger(
    'REALTIME_REQUEST_REPLAY_MAX_ENTRIES',
    10_000,
  ),
  wsReconnectBackoffMs: positiveInteger('WS_RECONNECT_BACKOFF_MS', 300),
});
