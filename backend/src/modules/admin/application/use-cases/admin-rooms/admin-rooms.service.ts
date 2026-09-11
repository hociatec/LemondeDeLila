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
    const olderThanMinutes = boundedInteger(input.olderThanMinutes, 0, 365 * 24 * 60);
    const limit = boundedInteger(input.limit, 1, 5_000);

    return this.rooms.adminCleanupRooms({
      includePrivate: input.includePrivate === true,
      includeStarted: input.includeStarted === true,
      olderThanMinutes,
      limit,
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
    const limit = boundedInteger(input.limit, 1, 1_000);
    return this.rooms.adminListRooms({
      limit,
      includePrivate: input.includePrivate !== false,
      includeStarted: input.includeStarted === true,
      joinableOnly: input.joinableOnly === true,
    });
  }

  async destroy(input: { roomId: string | number; confirm: boolean }) {
    if (input.confirm !== true) {
      throw new BadRequestException('Confirmation requise.');
    }

    const roomId = String(input.roomId ?? '').trim();
    if (!/^\d+$/.test(roomId) || Number(roomId) <= 0 || !Number.isSafeInteger(Number(roomId))) {
      throw new BadRequestException('Identifiant de salle invalide.');
    }
    return this.rooms.adminDestroyRoom(roomId);
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
    boundedInteger(update.autoCleanupOlderThanMinutes, 5, 24 * 60);
    boundedInteger(update.autoCleanupIntervalSeconds, 30, 24 * 60 * 60);
    boundedInteger(update.autoCleanupLimit, 1, 5_000);
    return this.roomSettings.update(update);
  }
}

function boundedInteger(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new BadRequestException('Paramètre numérique invalide.');
  }
  return value as number;
}
