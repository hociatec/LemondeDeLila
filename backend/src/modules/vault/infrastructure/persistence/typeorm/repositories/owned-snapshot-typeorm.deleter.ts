import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OwnedSnapshotDeleter } from '../../../../application/ports/owned-snapshot-deleter.port';
import { VaultRoomSnapshotEntity } from '../entities/vault-room-snapshot.entity';

@Injectable()
export class OwnedSnapshotTypeormDeleter implements OwnedSnapshotDeleter {
  constructor(
    @InjectRepository(VaultRoomSnapshotEntity)
    private readonly snapshots: Repository<VaultRoomSnapshotEntity>,
  ) {}

  async deleteOwnedSnapshot(id: string, ownerUserId: number): Promise<void> {
    await this.snapshots.delete({
      id,
      ownerUserId,
    });
  }
}
