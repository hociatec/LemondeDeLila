import {
  readEnvironment,
  type RuntimeEnvironmentKey,
} from './runtime-environment';

function positiveInteger(key: RuntimeEnvironmentKey, fallback: number): number {
  const value = Number(readEnvironment(key));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** Central operational timings; every value can be overridden by environment. */
export const operationalPolicy = Object.freeze({
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
  wsReconnectBackoffMs: positiveInteger('WS_RECONNECT_BACKOFF_MS', 300),
});
