import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ROOM_MAINTENANCE_SETTINGS_REPOSITORY,
  type RoomMaintenanceSettingsRepository,
} from '../ports/room-maintenance-settings.repository';
import {
  ROOM_MAINTENANCE_DEFAULTS,
  type RoomMaintenanceDefaults,
} from '../ports/room-maintenance-defaults.port';

export type RoomMaintenanceSettings = {
  autoCleanupEnabled: boolean;
  autoCleanupOlderThanMinutes: number;
  autoCleanupIntervalSeconds: number;
  autoCleanupLimit: number;
};

@Injectable()
export class RoomMaintenanceSettingsService implements OnModuleInit {
  private cache: RoomMaintenanceSettings | null = null;

  constructor(
    @Inject(ROOM_MAINTENANCE_SETTINGS_REPOSITORY)
    private readonly repo: RoomMaintenanceSettingsRepository,
    @Inject(ROOM_MAINTENANCE_DEFAULTS)
    private readonly defaultsConfig: RoomMaintenanceDefaults,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  private defaults(): RoomMaintenanceSettings {
    return this.normalize(this.defaultsConfig);
  }

  private normalize(
    input: Partial<RoomMaintenanceSettings>,
  ): RoomMaintenanceSettings {
    const enabled = input.autoCleanupEnabled === true;
    const interval = Number.isFinite(input.autoCleanupIntervalSeconds)
      ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds as number))
      : 300;
    const older = Number.isFinite(input.autoCleanupOlderThanMinutes)
      ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes as number))
      : 60;
    const limit = Number.isFinite(input.autoCleanupLimit)
      ? Math.max(
          1,
          Math.min(5000, Math.floor(input.autoCleanupLimit as number)),
        )
      : 1000;

    return {
      autoCleanupEnabled: enabled,
      autoCleanupIntervalSeconds: interval,
      autoCleanupOlderThanMinutes: older,
      autoCleanupLimit: limit,
    };
  }

  get(): RoomMaintenanceSettings {
    return this.cache ?? this.defaults();
  }

  async update(
    patch: Partial<RoomMaintenanceSettings>,
  ): Promise<RoomMaintenanceSettings> {
    await this.ensureSeeded();
    const current = this.get();
    const next = this.normalize({ ...current, ...patch });
    await this.repo.save({
      id: 1,
      autoCleanupEnabled: next.autoCleanupEnabled,
      autoCleanupIntervalSeconds: next.autoCleanupIntervalSeconds,
      autoCleanupOlderThanMinutes: next.autoCleanupOlderThanMinutes,
      autoCleanupLimit: next.autoCleanupLimit,
    });
    this.cache = next;
    return next;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    const existing = await this.repo.findSingleton(1);
    if (existing) {
      this.cache = this.normalize({
        autoCleanupEnabled: existing.autoCleanupEnabled,
        autoCleanupIntervalSeconds: existing.autoCleanupIntervalSeconds,
        autoCleanupOlderThanMinutes: existing.autoCleanupOlderThanMinutes,
        autoCleanupLimit: existing.autoCleanupLimit,
      });
      return;
    }

    const seed = this.defaults();
    await this.repo.insert({
      id: 1,
      autoCleanupEnabled: seed.autoCleanupEnabled,
      autoCleanupIntervalSeconds: seed.autoCleanupIntervalSeconds,
      autoCleanupOlderThanMinutes: seed.autoCleanupOlderThanMinutes,
      autoCleanupLimit: seed.autoCleanupLimit,
    });
    this.cache = seed;
  }
}
