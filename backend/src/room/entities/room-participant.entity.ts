import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';

@Entity({ name: 'room_participants' })
export class RoomParticipant {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 20, default: 'player' })
  role!: string;

  @CreateDateColumn({ name: 'joined_at', type: 'datetime' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'datetime', nullable: true })
  leftAt?: Date | null;
}
