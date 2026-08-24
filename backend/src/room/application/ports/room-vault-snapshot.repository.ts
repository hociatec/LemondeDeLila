export const ROOM_VAULT_SNAPSHOT_REPOSITORY = Symbol(
  'ROOM_VAULT_SNAPSHOT_REPOSITORY',
);

export interface RoomVaultSnapshotRepository {
  deleteOwnedSnapshot(id: string, ownerUserId: number): Promise<void>;
}
