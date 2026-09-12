import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  RoomMaintenanceSettingsRecord,
  RoomMaintenanceSettingsRepository,
} from '../../../../application/ports/room-maintenance-settings.repository';
import { RoomMaintenanceSettingsEntity } from '../entities/room-maintenance-settings.entity';

@Injectable()
export class RoomMaintenanceSettingsTypeormRepository implements RoomMaintenanceSettingsRepository {
  constructor(
    @InjectRepository(RoomMaintenanceSettingsEntity)
    private readonly settings: Repository<RoomMaintenanceSettingsEntity>,
  ) {}

  async findSingleton(
    id: number,
  ): Promise<RoomMaintenanceSettingsRecord | null> {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const row = await this.settings.findOne({ where: { id } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      autoCleanupEnabled: row.autoCleanupEnabled,
      autoCleanupIntervalSeconds: row.autoCleanupIntervalSeconds,
      autoCleanupOlderThanMinutes: row.autoCleanupOlderThanMinutes,
      autoCleanupLimit: row.autoCleanupLimit,
    };
  }

  async save(settings: RoomMaintenanceSettingsRecord): Promise<void> {
    await this.settings.save(normalizeSettings(settings));
  }

  async insert(settings: RoomMaintenanceSettingsRecord): Promise<void> {
    await this.settings.insert(normalizeSettings(settings));
  }
}

function normalizeSettings(
  settings: RoomMaintenanceSettingsRecord,
): RoomMaintenanceSettingsRecord {
  return {
    id: Number.isSafeInteger(settings.id) && settings.id > 0 ? settings.id : 1,
    autoCleanupEnabled: settings.autoCleanupEnabled === true,
    autoCleanupIntervalSeconds: Number.isSafeInteger(
      settings.autoCleanupIntervalSeconds,
    )
      ? Math.max(1, Math.min(86_400, settings.autoCleanupIntervalSeconds))
      : 300,
    autoCleanupOlderThanMinutes: Number.isSafeInteger(
      settings.autoCleanupOlderThanMinutes,
    )
      ? Math.max(1, Math.min(525_600, settings.autoCleanupOlderThanMinutes))
      : 60,
    autoCleanupLimit: Number.isSafeInteger(settings.autoCleanupLimit)
      ? Math.max(1, Math.min(10_000, settings.autoCleanupLimit))
      : 1_000,
  };
}
