import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
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

  @OneToMany(() => RoomParticipant, (p) => p.room)
  participants!: RoomParticipant[];

  @OneToMany(() => RoomBot, (b) => b.room)
  bots!: RoomBot[];
}
