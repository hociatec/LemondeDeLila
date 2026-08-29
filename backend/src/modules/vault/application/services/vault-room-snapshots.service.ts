import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ROOM_VAULT_PORT, type RoomVaultPort } from '../../../room/public-api';
import {
  VAULT_ROOM_SNAPSHOT_REPOSITORY,
  type VaultRoomSnapshotRepository,
} from '../ports/vault-room-snapshot.repository';
import { VaultSnapshotRestoreService } from './vault-snapshot-restore.service';
import { VaultSnapshotWriterService } from './vault-snapshot-writer.service';

@Injectable()
export class VaultRoomSnapshotsService {
  constructor(
    @Inject(VAULT_ROOM_SNAPSHOT_REPOSITORY)
    private readonly snapshots: VaultRoomSnapshotRepository,
    @Inject(ROOM_VAULT_PORT)
    private readonly rooms: RoomVaultPort,
    private readonly writer: VaultSnapshotWriterService,
    private readonly restorer: VaultSnapshotRestoreService,
  ) {}

  async list(ownerUserId: number): Promise<
    Array<{
      id: string;
      name: string;
      roomName: string;
      gameType: string;
      playersLabel: string;
      createdAt: string;
    }>
  > {
    const items = await this.snapshots.listByOwner(ownerUserId, 50);
    return items.map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      roomName: snapshot.roomName,
      gameType: snapshot.gameType,
      playersLabel: snapshot.playersLabel,
      createdAt: snapshot.createdAt.toISOString(),
    }));
  }

  async delete(ownerUserId: number, snapshotId: string): Promise<boolean> {
    const id = String(snapshotId ?? '').trim();
    if (!id) {
      throw new BadRequestException('id requis');
    }
    return this.snapshots.deleteByIdForOwner(id, ownerUserId);
  }

  save(
    ownerUserId: number,
    roomId: number,
    snapshotId?: string | null,
  ): Promise<{ id: string }> {
    return this.writer.save(ownerUserId, roomId, snapshotId);
  }

  restore(
    ownerUserId: number,
    snapshotId: string,
  ): Promise<{ roomId: number }> {
    return this.restorer.restore(ownerUserId, snapshotId);
  }

  async abandonRestoredRoom(
    ownerUserId: number,
    roomId: number,
  ): Promise<boolean> {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    if (id <= 0) {
      throw new BadRequestException('roomId invalide');
    }
    let snapshotId: string;
    try {
      const room = await this.rooms.requireRoomForOwnerAction(id, ownerUserId);
      snapshotId = String(room.restoredFromSnapshotId ?? '').trim();
      if (!snapshotId || room.restoredOwnerUserId !== ownerUserId) {
        return false;
      }
    } catch {
      return false;
    }
    try {
      await this.rooms.adminDestroyRoom(id);
      await this.snapshots.deleteByIdForOwner(snapshotId, ownerUserId);
      return true;
    } catch {
      return false;
    }
  }
}
