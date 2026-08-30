import { Injectable } from '@nestjs/common';
import type { RoomRecord } from '../../contracts/room-record.model';
import { RoomAdminContextService } from '../maintenance/room-admin-context.service';
import { RoomAdminMaintenanceService } from '../maintenance/room-admin-maintenance.service';

@Injectable()
export class RoomAccessService {
  constructor(
    private readonly roomAdminContext: RoomAdminContextService,
    private readonly adminMaintenance: RoomAdminMaintenanceService,
  ) {}

  async destroyRoom(roomId: number): Promise<{ ok: true; roomId: number }> {
    return this.adminMaintenance.adminDestroyRoom(
      this.roomAdminContext.createContext(),
      roomId,
    );
  }

  async setOwner(
    roomId: number,
    userId: number,
    newOwnerId: number,
  ): Promise<RoomRecord> {
    return this.adminMaintenance.setOwner(
      this.roomAdminContext.createContext(),
      roomId,
      userId,
      newOwnerId,
    );
  }

  async requireRoomForOwnerAction(
    roomId: number,
    userId: number,
  ): Promise<RoomRecord> {
    return this.adminMaintenance.requireRoomForOwnerAction(
      this.roomAdminContext.createContext(),
      roomId,
      userId,
    );
  }

  async saveRoom(room: RoomRecord): Promise<RoomRecord> {
    return this.adminMaintenance.saveRoom(
      this.roomAdminContext.createContext(),
      room,
    );
  }
}
/** Room application capability boundary. */
