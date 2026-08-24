import type { VaultRoomSnapshotRecord } from '../models/vault-room-snapshot.model';

export const VAULT_ROOM_SNAPSHOT_REPOSITORY = Symbol(
  'VAULT_ROOM_SNAPSHOT_REPOSITORY',
);

export interface VaultRoomSnapshotRepository {
  listByOwner(ownerUserId: number, limit: number): Promise<VaultRoomSnapshotRecord[]>;
  findByIdForOwner(
    id: string,
    ownerUserId: number,
  ): Promise<VaultRoomSnapshotRecord | null>;
  existsByIdForOwner(id: string, ownerUserId: number): Promise<boolean>;
  create(data: Partial<VaultRoomSnapshotRecord>): VaultRoomSnapshotRecord;
  save(entity: VaultRoomSnapshotRecord): Promise<VaultRoomSnapshotRecord>;
  deleteByIdForOwner(
    id: string,
    ownerUserId: number,
  ): Promise<boolean>;
}
