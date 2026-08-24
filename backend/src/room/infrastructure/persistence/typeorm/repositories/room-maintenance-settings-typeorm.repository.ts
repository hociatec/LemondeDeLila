import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  RoomMaintenanceSettingsRecord,
  RoomMaintenanceSettingsRepository,
} from '../../../../application/ports/room-maintenance-settings.repository';
import { RoomMaintenanceSettingsEntity } from '../entities/room-maintenance-settings.entity';

@Injectable()
export class RoomMaintenanceSettingsTypeormRepository
  implements RoomMaintenanceSettingsRepository
{
  constructor(
    @InjectRepository(RoomMaintenanceSettingsEntity)
    private readonly settings: Repository<RoomMaintenanceSettingsEntity>,
  ) {}

  async findSingleton(id: number): Promise<RoomMaintenanceSettingsRecord | null> {
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
    await this.settings.save(settings);
  }

  async insert(settings: RoomMaintenanceSettingsRecord): Promise<void> {
    await this.settings.insert(settings);
  }
}
