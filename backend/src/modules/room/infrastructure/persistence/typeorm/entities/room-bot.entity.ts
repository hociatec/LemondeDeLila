import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { RoomPersistenceRef } from './room.persistence-ref';

@Entity({ name: 'room_bots' })
export class RoomBot {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne('Room', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: Relation<RoomPersistenceRef>;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
