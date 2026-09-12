import { Injectable } from '@nestjs/common';
import type {
  RoomVaultPort,
  RoomVaultRoomRecord,
} from '../../application/ports/room-vault.port';
import { RoomAccessService } from '../../application/services/membership/room-access.service';
import { RoomLifecycleFacadeService } from '../../application/services/lifecycle/room-lifecycle-facade.service';
import { RoomMembershipFacadeService } from '../../application/services/membership/room-membership-facade.service';
import { RoomStateService } from '../../application/services/state/room-state.service';
import type { RoomCreateCommand } from '../../application/models/room-create-command';
import type { Room } from '../persistence/typeorm/entities/room.entity';
import type { RoomRecord } from '../../application/models/room-record.model';
import type { RoomSnapshotProjection } from '../../application/contracts/room-snapshot-projection';

@Injectable()
export class RoomVaultAdapter implements RoomVaultPort {
  constructor(
    private readonly roomAccess: RoomAccessService,
    private readonly lifecycle: RoomLifecycleFacadeService,
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
  ) {}

  async getRoomPayload(roomId: number): Promise<RoomSnapshotProjection> {
    const { room } = await this.roomState.getRoomPayload(roomId);
    return {
      schemaVersion: 1,
      room: {
        id: room.id,
        name: room.name,
        gameType: room.gameType,
        status: room.status,
        startedAt:
          room.startedAt instanceof Date
            ? room.startedAt.toISOString()
            : (room.startedAt ?? null),
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
        tableAmbienceSoundId: room.tableAmbienceSoundId ?? null,
        owner: room.owner ? { id: room.owner.id } : null,
        players: room.players
          .slice(0, 64)
          .map(({ id, username }) => ({ id, username })),
        spectators: room.spectators.slice(0, 64).map(({ id, username }) => ({
          id,
          username,
        })),
        bots: room.bots.slice(0, 64).map(({ id, name }) => ({ id, name })),
      },
    };
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

  async createRoom(command: RoomCreateCommand) {
    const room = await this.membership.createRoom(command);
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
