export interface AdminRoomMaintenanceSettings {
  autoCleanupEnabled?: boolean;
  autoCleanupOlderThanMinutes?: number;
  autoCleanupIntervalSeconds?: number;
  autoCleanupLimit?: number;
}

export interface AdminRoomsPort {
  adminCleanupRooms(input: {
    includePrivate: boolean;
    includeStarted: boolean;
    olderThanMinutes?: number;
    limit?: number;
    dryRun: boolean;
    excludeActivePlayers: boolean;
  }): Promise<unknown>;
  adminListRooms(input: {
    limit?: number;
    includePrivate: boolean;
    includeStarted: boolean;
    joinableOnly: boolean;
  }): Promise<unknown>;
  adminDestroyRoom(roomId: string): Promise<unknown>;
}

export interface AdminRoomSettingsPort {
  get(): AdminRoomMaintenanceSettings;
  update(
    update: AdminRoomMaintenanceSettings,
  ): Promise<AdminRoomMaintenanceSettings>;
}

export const ADMIN_ROOMS_PORT = Symbol('ADMIN_ROOMS_PORT');
export const ADMIN_ROOM_SETTINGS_PORT = Symbol('ADMIN_ROOM_SETTINGS_PORT');
