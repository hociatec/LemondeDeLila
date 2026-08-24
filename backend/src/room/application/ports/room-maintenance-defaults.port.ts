export const ROOM_MAINTENANCE_DEFAULTS = Symbol(
  'ROOM_MAINTENANCE_DEFAULTS',
);

export type RoomMaintenanceDefaults = {
  autoCleanupEnabled: boolean;
  autoCleanupOlderThanMinutes: number;
  autoCleanupIntervalSeconds: number;
  autoCleanupLimit: number;
};
