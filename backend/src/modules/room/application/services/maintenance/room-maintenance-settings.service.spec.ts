import { RoomMaintenanceSettingsService } from './room-maintenance-settings.service';
import type { RoomMaintenanceSettingsRepository } from '../../ports/room-maintenance-settings.repository';
import { createRoomMaintenanceDefaults } from '../../../infrastructure/config/room-maintenance-defaults.config';
import { ConfigService } from '@nestjs/config';

describe('RoomMaintenanceSettingsService', () => {
  beforeEach(() => {
    delete process.env.ROOM_AUTO_CLEANUP_ENABLED;
    delete process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS;
    delete process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES;
    delete process.env.ROOM_AUTO_CLEANUP_LIMIT;
  });

  it('seeds defaults when repository is empty', async () => {
    const insert = jest.fn(async () => undefined);
    const repo: RoomMaintenanceSettingsRepository = {
      findSingleton: jest.fn(async () => null),
      save: jest.fn(async () => undefined),
      insert,
    };

    process.env.ROOM_AUTO_CLEANUP_ENABLED = 'true';
    process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS = '120';
    process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES = '45';
    process.env.ROOM_AUTO_CLEANUP_LIMIT = '50';

    const service = new RoomMaintenanceSettingsService(
      repo,
      createRoomMaintenanceDefaults(new ConfigService()),
    );
    await service.onModuleInit();

    expect(insert).toHaveBeenCalledWith({
      id: 1,
      autoCleanupEnabled: true,
      autoCleanupIntervalSeconds: 120,
      autoCleanupOlderThanMinutes: 45,
      autoCleanupLimit: 50,
    });
    expect(service.get()).toEqual({
      autoCleanupEnabled: true,
      autoCleanupIntervalSeconds: 120,
      autoCleanupOlderThanMinutes: 45,
      autoCleanupLimit: 50,
    });
  });

  it('normalizes updates before saving', async () => {
    const save = jest.fn(async () => undefined);
    const repo: RoomMaintenanceSettingsRepository = {
      findSingleton: jest.fn(async () => ({
        id: 1,
        autoCleanupEnabled: false,
        autoCleanupIntervalSeconds: 300,
        autoCleanupOlderThanMinutes: 60,
        autoCleanupLimit: 1000,
      })),
      save,
      insert: jest.fn(async () => undefined),
    };

    const service = new RoomMaintenanceSettingsService(
      repo,
      createRoomMaintenanceDefaults(new ConfigService()),
    );
    await service.onModuleInit();

    const updated = await service.update({
      autoCleanupEnabled: true,
      autoCleanupIntervalSeconds: 1,
      autoCleanupOlderThanMinutes: 1,
      autoCleanupLimit: 999999,
    });

    expect(updated).toEqual({
      autoCleanupEnabled: true,
      autoCleanupIntervalSeconds: 30,
      autoCleanupOlderThanMinutes: 5,
      autoCleanupLimit: 5000,
    });
    expect(save).toHaveBeenCalledWith({
      id: 1,
      autoCleanupEnabled: true,
      autoCleanupIntervalSeconds: 30,
      autoCleanupOlderThanMinutes: 5,
      autoCleanupLimit: 5000,
    });
  });
});
/** Room application capability boundary. */
