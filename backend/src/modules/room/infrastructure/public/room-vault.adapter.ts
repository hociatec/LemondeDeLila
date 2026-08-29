import { Injectable } from '@nestjs/common';
import type {
  RoomVaultPort,
  RoomVaultRoomRecord,
} from '../../application/ports/room-vault.port';
import { RoomAccessService } from '../../application/services/room-access.service';
import { RoomLifecycleFacadeService } from '../../application/services/room-lifecycle-facade.service';
import { RoomMembershipFacadeService } from '../../application/services/room-membership-facade.service';
import { RoomStateService } from '../../application/services/room-state.service';
import type { Room } from '../persistence/typeorm/entities/room.entity';
import type { RoomRecord } from '../../application/models/room-record.model';

@Injectable()
export class RoomVaultAdapter implements RoomVaultPort {
  constructor(
    private readonly roomAccess: RoomAccessService,
    private readonly lifecycle: RoomLifecycleFacadeService,
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
  ) {}

  getRoomPayload(roomId: number) {
    return this.roomState.getRoomPayload(roomId);
  }

  async requireRoomForOwnerAction(roomId: number, userId: number) {
    const room = await this.roomAccess.requireRoomForOwnerAction(
      roomId,
      userId,
    );
    return this.toRecord(room);
  }

  adminDestroyRoom(roomId: number) {
    return this.roomAccess.destroyRoom(roomId);
  }

  findLatestActiveRoomForUser(userId: number) {
    return this.membership.findLatestActiveRoomForUser(userId);
  }

  async createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
    invalidateCache = true,
  ) {
    const room = await this.membership.createRoom(
      userId,
      gameType,
      name,
      maxPlayers,
      isPrivate,
      invalidateCache,
    );
    return this.toRecord(room);
  }

  async saveRoom(room: RoomVaultRoomRecord) {
    const entity = await this.roomAccess.requireRoomForOwnerAction(
      room.id,
      room.ownerId ?? 0,
    );
    entity.name = room.name;
    entity.gameType = room.gameType;
    entity.maxPlayers = room.maxPlayers;
    entity.isPrivate = room.isPrivate;
    entity.status = room.status;
    entity.startedAt = room.startedAt;
    entity.runId = room.runId;
    entity.tableAmbienceSoundId = room.tableAmbienceSoundId;
    entity.restoredFromSnapshotId = room.restoredFromSnapshotId;
    entity.restoredOwnerUserId = room.restoredOwnerUserId;
    const saved = await this.roomAccess.saveRoom(entity);
    return this.toRecord(saved);
  }

  async joinRoom(
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ) {
    const room = await this.membership.joinRoom(roomId, userId, opts);
    return this.toRecord(room);
  }

  invalidateRoomPayloadCache(roomId: number) {
    return this.roomState.invalidateRoomPayloadCache(roomId);
  }

  async startRoom(roomId: number, userId: number, invalidateCache = true) {
    const room = await this.lifecycle.startRoom(
      roomId,
      userId,
      invalidateCache,
    );
    return this.toRecord(room);
  }

  notifyRoomStateUpdated(roomId: number) {
    return this.roomState.notifyRoomStateUpdated(roomId);
  }

  private toRecord(room: Room | RoomRecord): RoomVaultRoomRecord {
    return {
      id: room.id,
      name: room.name,
      gameType: room.gameType,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      status: room.status,
      ownerId: room.owner?.id ?? null,
      startedAt: room.startedAt ?? null,
      runId: room.runId,
      tableAmbienceSoundId: room.tableAmbienceSoundId ?? null,
      restoredFromSnapshotId: room.restoredFromSnapshotId ?? null,
      restoredOwnerUserId: room.restoredOwnerUserId ?? null,
    };
  }
}
