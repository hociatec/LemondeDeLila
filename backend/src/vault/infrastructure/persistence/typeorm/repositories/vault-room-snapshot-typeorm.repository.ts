import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { VaultRoomSnapshotRecord } from '../../../../application/models/vault-room-snapshot.model';
import type { VaultRoomSnapshotRepository } from '../../../../application/ports/vault-room-snapshot.repository';
import { VaultRoomSnapshotEntity } from '../entities/vault-room-snapshot.entity';

@Injectable()
export class VaultRoomSnapshotTypeormRepository implements VaultRoomSnapshotRepository {
  constructor(
    @InjectRepository(VaultRoomSnapshotEntity)
    private readonly snapshots: Repository<VaultRoomSnapshotEntity>,
  ) {}

  async listByOwner(
    ownerUserId: number,
    limit: number,
  ): Promise<VaultRoomSnapshotRecord[]> {
    const rows = await this.snapshots.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((row) => this.toModel(row));
  }

  async findByIdForOwner(
    id: string,
    ownerUserId: number,
  ): Promise<VaultRoomSnapshotRecord | null> {
    const row = await this.snapshots.findOne({ where: { id, ownerUserId } });
    return row ? this.toModel(row) : null;
  }

  async existsByIdForOwner(id: string, ownerUserId: number): Promise<boolean> {
    const found = await this.snapshots.findOne({
      where: { id, ownerUserId },
      select: { id: true },
    });
    return Boolean(found);
  }

  create(data: Partial<VaultRoomSnapshotRecord>): VaultRoomSnapshotRecord {
    return this.toModel(this.snapshots.create(data));
  }

  async save(
    entity: VaultRoomSnapshotRecord,
  ): Promise<VaultRoomSnapshotRecord> {
    const saved = await this.snapshots.save(this.snapshots.create(entity));
    return this.toModel(saved);
  }

  async deleteByIdForOwner(id: string, ownerUserId: number): Promise<boolean> {
    const result = await this.snapshots.delete({ id, ownerUserId });
    return (result.affected ?? 0) > 0;
  }

  private toModel(entity: VaultRoomSnapshotEntity): VaultRoomSnapshotRecord {
    return {
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      name: entity.name,
      gameType: entity.gameType,
      roomName: entity.roomName,
      playersLabel: entity.playersLabel,
      snapshotJson: entity.snapshotJson,
      createdAt: entity.createdAt,
    };
  }
}
