import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { RoomVaultSnapshotRepository } from '../../../../application/ports/room-vault-snapshot.repository';

export const ROOM_VAULT_SNAPSHOTS_TYPEORM_REPOSITORY = Symbol(
  'ROOM_VAULT_SNAPSHOTS_TYPEORM_REPOSITORY',
);

type VaultRoomSnapshotRow = {
  id: string;
  ownerUserId: number;
};

@Injectable()
export class RoomVaultSnapshotTypeormRepository
  implements RoomVaultSnapshotRepository
{
  constructor(
    @Inject(ROOM_VAULT_SNAPSHOTS_TYPEORM_REPOSITORY)
    private readonly snapshots: Repository<VaultRoomSnapshotRow>,
  ) {}

  async deleteOwnedSnapshot(id: string, ownerUserId: number): Promise<void> {
    await this.snapshots.delete({
      id,
      ownerUserId,
    });
  }
}
