export const ROOM_MAINTENANCE_SETTINGS_REPOSITORY = Symbol(
  'ROOM_MAINTENANCE_SETTINGS_REPOSITORY',
);

export type RoomMaintenanceSettingsRecord = {
  id: number;
  autoCleanupEnabled: boolean;
  autoCleanupIntervalSeconds: number;
  autoCleanupOlderThanMinutes: number;
  autoCleanupLimit: number;
};

export interface RoomMaintenanceSettingsRepository {
  findSingleton(id: number): Promise<RoomMaintenanceSettingsRecord | null>;
  save(settings: RoomMaintenanceSettingsRecord): Promise<void>;
  insert(settings: RoomMaintenanceSettingsRecord): Promise<void>;
}
