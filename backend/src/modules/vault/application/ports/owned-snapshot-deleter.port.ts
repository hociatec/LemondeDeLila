export const OWNED_SNAPSHOT_DELETER = Symbol('OWNED_SNAPSHOT_DELETER');
export interface OwnedSnapshotDeleter {
  deleteOwnedSnapshot(id: string, ownerUserId: number): Promise<void>;
}
