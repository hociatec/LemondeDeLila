import { DataSource } from 'typeorm';
import { VaultRoomSnapshotEntity } from '../entities/vault-room-snapshot.entity';
import { OwnedSnapshotTypeormDeleter } from './owned-snapshot-typeorm.deleter';

it('scopes snapshot deletion to both snapshot and owner identifiers', async () => {
  const repository = new DataSource({ type: 'mysql' }).getRepository(
    VaultRoomSnapshotEntity,
  );
  const deletion = jest
    .spyOn(repository, 'delete')
    .mockResolvedValue({ raw: [], affected: 0 });
  await new OwnedSnapshotTypeormDeleter(repository).deleteOwnedSnapshot(
    'snapshot',
    42,
  );
  expect(deletion).toHaveBeenCalledWith({ id: 'snapshot', ownerUserId: 42 });
});
