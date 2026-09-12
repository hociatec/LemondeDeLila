import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { prometheusMetrics } from '../../../../platform/observability/public-api';
import { VAULT_ROOM_PORT, type VaultRoomPort } from '../ports/vault-room.port';
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
    @Inject(VAULT_ROOM_PORT)
    private readonly rooms: Pick<
      VaultRoomPort,
      'adminDestroyRoom' | 'requireRoomForOwnerAction'
    >,
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
    if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) return [];
    const items = await this.snapshots.listByOwner(ownerUserId, 50);
    return items.map((snapshot) => ({
      id: String(snapshot.id).slice(0, 128),
      name: String(snapshot.name).slice(0, 255),
      roomName: String(snapshot.roomName).slice(0, 255),
      gameType: String(snapshot.gameType).slice(0, 128),
      playersLabel: String(snapshot.playersLabel).slice(0, 255),
      createdAt: snapshot.createdAt.toISOString(),
    }));
  }

  async delete(ownerUserId: number, snapshotId: string): Promise<boolean> {
    const id = String(snapshotId ?? '').trim();
    if (
      !id ||
      id.length > 128 ||
      !Number.isSafeInteger(ownerUserId) ||
      ownerUserId <= 0
    ) {
      throw new BadRequestException('id requis');
    }
    return this.snapshots.deleteByIdForOwner(id, ownerUserId);
  }

  save(
    ownerUserId: number,
    roomId: number,
    snapshotId?: string | null,
  ): Promise<{ id: string }> {
    if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) {
      throw new BadRequestException('ownerUserId invalide');
    }
    return this.writer
      .save(ownerUserId, roomId, snapshotId)
      .catch((error: unknown) => {
        prometheusMetrics.game.recordFailure(
          'unknown',
          'VAULT_SAVE_FAILED',
          'snapshot',
        );
        throw error;
      });
  }

  restore(
    ownerUserId: number,
    snapshotId: string,
  ): Promise<{ roomId: number }> {
    if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) {
      throw new BadRequestException('ownerUserId invalide');
    }
    return this.restorer
      .restore(ownerUserId, snapshotId)
      .catch((error: unknown) => {
        prometheusMetrics.game.recordFailure(
          'unknown',
          'VAULT_RESTORE_FAILED',
          'restore',
        );
        throw error;
      });
  }

  async abandonRestoredRoom(
    ownerUserId: number,
    roomId: number,
  ): Promise<boolean> {
    const id =
      typeof roomId === 'number' && Number.isSafeInteger(roomId) && roomId > 0
        ? roomId
        : 0;
    if (id <= 0) {
      throw new BadRequestException('roomId invalide');
    }
    let snapshotId: string;
    try {
      const room = await this.rooms.requireRoomForOwnerAction(id, ownerUserId);
      snapshotId = String(room.restoredFromSnapshotId ?? '')
        .trim()
        .slice(0, 128);
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
