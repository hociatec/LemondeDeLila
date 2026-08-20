import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_ROOMS_PORT,
  ADMIN_ROOM_SETTINGS_PORT,
  type AdminRoomsPort,
  type AdminRoomSettingsPort,
} from '../../ports/admin-room.port';

@Injectable()
export class AdminRoomsService {
  constructor(
    @Inject(ADMIN_ROOMS_PORT)
    private readonly rooms: AdminRoomsPort,
    @Inject(ADMIN_ROOM_SETTINGS_PORT)
    private readonly roomSettings: AdminRoomSettingsPort,
  ) {}

  async cleanup(input: {
    confirm: boolean;
    includePrivate?: boolean;
    includeStarted?: boolean;
    olderThanMinutes?: number;
    limit?: number;
    dryRun?: boolean;
  }) {
    if (input.confirm !== true) {
      throw new BadRequestException('Confirmation requise.');
    }

    return this.rooms.adminCleanupRooms({
      includePrivate: input.includePrivate === true,
      includeStarted: input.includeStarted === true,
      olderThanMinutes: input.olderThanMinutes,
      limit: input.limit,
      dryRun: input.dryRun === true,
      excludeActivePlayers: true,
    });
  }

  list(input: {
    limit?: number;
    includePrivate?: boolean;
    includeStarted?: boolean;
    joinableOnly?: boolean;
  }) {
    return this.rooms.adminListRooms({
      limit: input.limit,
      includePrivate: input.includePrivate !== false,
      includeStarted: input.includeStarted === true,
      joinableOnly: input.joinableOnly === true,
    });
  }

  async destroy(input: { roomId: string; confirm: boolean }) {
    if (input.confirm !== true) {
      throw new BadRequestException('Confirmation requise.');
    }

    return this.rooms.adminDestroyRoom(input.roomId);
  }

  getSettings() {
    return this.roomSettings.get();
  }

  updateSettings(update: {
    autoCleanupEnabled?: boolean;
    autoCleanupOlderThanMinutes?: number;
    autoCleanupIntervalSeconds?: number;
    autoCleanupLimit?: number;
  }) {
    return this.roomSettings.update(update);
  }
}
