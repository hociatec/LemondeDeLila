import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RoomVaultSnapshotRepository } from '../../../../application/ports/room-vault-snapshot.repository';
import { VaultRoomSnapshotEntity } from '../../../../../vault/infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';

@Injectable()
export class RoomVaultSnapshotTypeormRepository
  implements RoomVaultSnapshotRepository
{
  constructor(
    @InjectRepository(VaultRoomSnapshotEntity)
    private readonly snapshots: Repository<VaultRoomSnapshotEntity>,
  ) {}

  async deleteOwnedSnapshot(id: string, ownerUserId: number): Promise<void> {
    await this.snapshots.delete({
      id,
      ownerUserId,
    } as VaultRoomSnapshotEntity);
  }
}
