import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { RoomPersistenceRef } from './room.persistence-ref';
import type { RoomUserPersistenceRef } from './room-user.persistence-ref';

@Entity({ name: 'room_participants' })
@Index('idx_room_participants_room_active_joined', [
  'room',
  'leftAt',
  'joinedAt',
])
@Index('idx_room_participants_user_active', ['user', 'leftAt'])
export class RoomParticipant {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne('Room', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: Relation<RoomPersistenceRef>;

  @ManyToOne('User', { eager: true })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<RoomUserPersistenceRef>;

  @Column({ type: 'varchar', length: 20, default: 'player' })
  role!: string;

  @CreateDateColumn({ name: 'joined_at', type: 'datetime' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'datetime', nullable: true })
  leftAt?: Date | null;
}
