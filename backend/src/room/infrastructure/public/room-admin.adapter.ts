import { Injectable } from '@nestjs/common';
import type { RoomAdminPort } from '../../application/ports/room-admin.port';
import { RoomAdminContextService } from '../../application/services/room-admin-context.service';
import { RoomAdminMaintenanceService } from '../../application/services/room-admin-maintenance.service';

@Injectable()
export class RoomAdminAdapter implements RoomAdminPort {
  constructor(
    private readonly roomAdminContext: RoomAdminContextService,
    private readonly adminMaintenance: RoomAdminMaintenanceService,
  ) {}

  adminCleanupRooms(input: {
    includePrivate: boolean;
    includeStarted: boolean;
    olderThanMinutes?: number;
    limit?: number;
    dryRun: boolean;
    excludeActivePlayers: boolean;
  }): Promise<unknown> {
    return this.adminMaintenance.adminCleanupRooms(
      this.roomAdminContext.createContext(),
      input,
    );
  }

  adminListRooms(input: {
    limit?: number;
    includePrivate: boolean;
    includeStarted: boolean;
    joinableOnly: boolean;
  }): Promise<unknown> {
    return this.adminMaintenance.adminListRooms(input);
  }

  adminDestroyRoom(roomId: number): Promise<{ ok: true; roomId: number }> {
    return this.adminMaintenance.adminDestroyRoom(
      this.roomAdminContext.createContext(),
      roomId,
    );
  }
}
