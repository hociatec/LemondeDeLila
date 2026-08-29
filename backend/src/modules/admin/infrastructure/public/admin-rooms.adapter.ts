import { Inject, Injectable } from '@nestjs/common';
import { type AdminRoomsPort } from '../../application/ports/admin-room.port';
import { ROOM_ADMIN_PORT, type RoomAdminPort } from '../../../room/public-api';

@Injectable()
export class AdminRoomsAdapter implements AdminRoomsPort {
  constructor(
    @Inject(ROOM_ADMIN_PORT)
    private readonly rooms: RoomAdminPort,
  ) {}

  adminCleanupRooms(input: {
    includePrivate: boolean;
    includeStarted: boolean;
    olderThanMinutes?: number;
    limit?: number;
    dryRun: boolean;
    excludeActivePlayers: boolean;
  }): Promise<unknown> {
    return this.rooms.adminCleanupRooms(input);
  }

  adminListRooms(input: {
    limit?: number;
    includePrivate: boolean;
    includeStarted: boolean;
    joinableOnly: boolean;
  }): Promise<unknown> {
    return this.rooms.adminListRooms(input);
  }

  adminDestroyRoom(roomId: string): Promise<unknown> {
    return this.rooms.adminDestroyRoom(Number(roomId));
  }
}
