import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../../../user/public-api';
import { RoomParticipant } from './room-participant.entity';
import { RoomBot } from './room-bot.entity';

@Entity({ name: 'rooms' })
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'game_type', type: 'varchar', length: 100 })
  gameType!: string;

  @Column({ name: 'max_players', type: 'int', default: 4 })
  maxPlayers!: number;

  @Column({ name: 'is_private', type: 'boolean', default: false })
  isPrivate!: boolean;

  @Column({ type: 'varchar', length: 50, default: 'setup' })
  status!: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'run_id', type: 'int', default: 0 })
  runId!: number;

  @Column({
    name: 'table_ambience_sound_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  tableAmbienceSoundId?: string | null;

  @Column({
    name: 'restored_from_snapshot_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  restoredFromSnapshotId?: string | null;

  @Column({ name: 'restored_owner_user_id', type: 'int', nullable: true })
  restoredOwnerUserId?: number | null;

  @OneToMany(() => RoomParticipant, (participant) => participant.room)
  participants!: RoomParticipant[];

  @OneToMany(() => RoomBot, (bot) => bot.room)
  bots!: RoomBot[];
}
