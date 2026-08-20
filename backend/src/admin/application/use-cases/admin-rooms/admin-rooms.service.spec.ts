import { BadRequestException } from '@nestjs/common';
import { AdminRoomsService } from './admin-rooms.service';

describe('AdminRoomsService', () => {
  it('requires confirmation before cleanup', async () => {
    const service = new AdminRoomsService(
      {
        adminCleanupRooms: jest.fn(),
        adminListRooms: jest.fn(),
        adminDestroyRoom: jest.fn(),
      } as any,
      {
        get: jest.fn(),
        update: jest.fn(),
      } as any,
    );

    await expect(service.cleanup({ confirm: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates room cleanup with admin defaults', async () => {
    const adminCleanupRooms = jest.fn().mockResolvedValue({ deleted: 3 });
    const service = new AdminRoomsService(
      {
        adminCleanupRooms,
        adminListRooms: jest.fn(),
        adminDestroyRoom: jest.fn(),
      } as any,
      {
        get: jest.fn(),
        update: jest.fn(),
      } as any,
    );

    await expect(
      service.cleanup({
        confirm: true,
        includePrivate: true,
        includeStarted: false,
        olderThanMinutes: 60,
        limit: 10,
        dryRun: true,
      }),
    ).resolves.toEqual({ deleted: 3 });

    expect(adminCleanupRooms).toHaveBeenCalledWith({
      includePrivate: true,
      includeStarted: false,
      olderThanMinutes: 60,
      limit: 10,
      dryRun: true,
      excludeActivePlayers: true,
    });
  });

  it('delegates settings update', async () => {
    const update = jest.fn().mockResolvedValue({ autoCleanupEnabled: true });
    const service = new AdminRoomsService(
      {
        adminCleanupRooms: jest.fn(),
        adminListRooms: jest.fn(),
        adminDestroyRoom: jest.fn(),
      } as any,
      {
        get: jest.fn(),
        update,
      } as any,
    );

    await expect(
      service.updateSettings({ autoCleanupEnabled: true }),
    ).resolves.toEqual({ autoCleanupEnabled: true });

    expect(update).toHaveBeenCalledWith({ autoCleanupEnabled: true });
  });
});
