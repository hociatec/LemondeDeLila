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
import { GameMatchPlayer } from './game-match-player.entity';

@Entity({ name: 'game_matches' })
export class GameMatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'room_id', type: 'int' })
  roomId!: number;

  @Column({ name: 'game_type', type: 'varchar', length: 100 })
  gameType!: string;

  @Column({ name: 'with_bots', type: 'boolean', default: false })
  withBots!: boolean;

  @Column({ name: 'bots_count', type: 'int', default: 0 })
  botsCount!: number;

  @Column({ name: 'humans_count', type: 'int', default: 0 })
  humansCount!: number;

  @CreateDateColumn({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt?: Date | null;

  @Column({ name: 'ended_reason', type: 'varchar', length: 20, nullable: true })
  endedReason?: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'winner_user_id' })
  winnerUser?: User | null;

  @OneToMany(() => GameMatchPlayer, (p) => p.match)
  players!: GameMatchPlayer[];
}

