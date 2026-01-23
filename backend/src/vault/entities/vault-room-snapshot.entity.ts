import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'vault_room_snapshots' })
@Index('idx_vault_room_snapshots_owner_created_at', ['ownerUserId', 'createdAt'])
export class VaultRoomSnapshotEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'owner_user_id', type: 'int' })
  ownerUserId!: number;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'game_type', type: 'varchar', length: 100 })
  gameType!: string;

  @Column({ name: 'room_name', type: 'varchar', length: 255 })
  roomName!: string;

  @Column({ name: 'players_label', type: 'varchar', length: 255 })
  playersLabel!: string;

  @Column({ name: 'snapshot_json', type: 'longtext' })
  snapshotJson!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
