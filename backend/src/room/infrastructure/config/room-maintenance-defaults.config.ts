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

  return {
    autoCleanupEnabled:
      enabledRaw === '1' ||
      enabledRaw === 'true' ||
      enabledRaw === 'yes' ||
      enabledRaw === 'y',
    autoCleanupIntervalSeconds: Number.parseInt(
      String(config.get<string>('ROOM_AUTO_CLEANUP_INTERVAL_SECONDS') ?? '300'),
      10,
    ),
    autoCleanupOlderThanMinutes: Number.parseInt(
      String(
        config.get<string>('ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES') ?? '60',
      ),
      10,
    ),
    autoCleanupLimit: Number.parseInt(
      String(config.get<string>('ROOM_AUTO_CLEANUP_LIMIT') ?? '1000'),
      10,
    ),
  };
}
