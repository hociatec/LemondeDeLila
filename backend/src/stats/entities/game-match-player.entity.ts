import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { GameMatch } from './game-match.entity';

export type GameMatchOutcome = 'unknown' | 'won' | 'lost' | 'quit' | 'draw';

@Entity({ name: 'game_match_players' })
@Unique('uniq_game_match_player', ['match', 'user'])
export class GameMatchPlayer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => GameMatch, (m) => m.players, { eager: false })
  @JoinColumn({ name: 'match_id' })
  @Index('idx_game_match_players_match')
  match!: Relation<GameMatch>;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  @Index('idx_game_match_players_user')
  user!: Relation<User>;

  @Column({ type: 'varchar', length: 80 })
  username!: string;

  @Column({ type: 'varchar', length: 20, default: `'unknown'` })
  @Index('idx_game_match_players_outcome')
  outcome!: GameMatchOutcome;

  @Column({ name: 'left_at', type: 'datetime', nullable: true })
  leftAt?: Date | null;
}
