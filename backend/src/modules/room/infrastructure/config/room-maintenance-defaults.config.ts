import { ConfigService } from '@nestjs/config';
import type { RoomMaintenanceDefaults } from '../../application/ports/room-maintenance-defaults.port';

export function createRoomMaintenanceDefaults(
  config: ConfigService,
): RoomMaintenanceDefaults {
  const enabledRaw = String(
    config.get<string>('ROOM_AUTO_CLEANUP_ENABLED') ?? '',
  )
    .trim()
    .toLowerCase();

  const boundedInteger = (
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    const value = Number(String(config.get<string>(key) ?? fallback));
    return Number.isSafeInteger(value) && value >= min && value <= max
      ? value
      : fallback;
  };

  return {
    autoCleanupEnabled:
      enabledRaw === '1' ||
      enabledRaw === 'true' ||
      enabledRaw === 'yes' ||
      enabledRaw === 'y',
    autoCleanupIntervalSeconds: boundedInteger(
      'ROOM_AUTO_CLEANUP_INTERVAL_SECONDS',
      300,
      1,
      86_400,
    ),
    autoCleanupOlderThanMinutes: boundedInteger(
      'ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES',
      60,
      1,
      525_600,
    ),
    autoCleanupLimit: boundedInteger(
      'ROOM_AUTO_CLEANUP_LIMIT',
      1000,
      1,
      10_000,
    ),
  };
}
