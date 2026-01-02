import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMaintenanceSettingsEntity } from '../entities/room-maintenance-settings.entity';

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
    @InjectRepository(RoomMaintenanceSettingsEntity)
    private readonly repo: Repository<RoomMaintenanceSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  private defaults(): RoomMaintenanceSettings {
    const enabledRaw = (process.env.ROOM_AUTO_CLEANUP_ENABLED || '').trim().toLowerCase();
    const enabled =
      enabledRaw === '1' ||
      enabledRaw === 'true' ||
      enabledRaw === 'yes' ||
      enabledRaw === 'y';

    const intervalSeconds = Number.parseInt(
      (process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS || '300').trim(),
      10,
    );
    const olderThanMinutes = Number.parseInt(
      (process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES || '60').trim(),
      10,
    );
    const limit = Number.parseInt(
      (process.env.ROOM_AUTO_CLEANUP_LIMIT || '1000').trim(),
      10,
    );

    return this.normalize({
      autoCleanupEnabled: enabled,
      autoCleanupIntervalSeconds: intervalSeconds,
      autoCleanupOlderThanMinutes: olderThanMinutes,
      autoCleanupLimit: limit,
    });
  }

  private normalize(input: Partial<RoomMaintenanceSettings>): RoomMaintenanceSettings {
    const enabled = input.autoCleanupEnabled === true;
    const interval = Number.isFinite(input.autoCleanupIntervalSeconds as number)
      ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds as number))
      : 300;
    const older = Number.isFinite(input.autoCleanupOlderThanMinutes as number)
      ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes as number))
      : 60;
    const limit = Number.isFinite(input.autoCleanupLimit as number)
      ? Math.max(1, Math.min(5000, Math.floor(input.autoCleanupLimit as number)))
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

  async update(patch: Partial<RoomMaintenanceSettings>): Promise<RoomMaintenanceSettings> {
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

    const existing = await this.repo.findOne({ where: { id: 1 } });
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
