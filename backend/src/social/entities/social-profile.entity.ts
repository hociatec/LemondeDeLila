import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type SocialProfileVisibility = 'public' | 'friends' | 'private';

@Entity({ name: 'social_profiles' })
export class SocialProfile {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId!: number;

  @OneToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'longtext', nullable: true })
  bio?: string | null;

  @Column({
    name: 'victory_message',
    type: 'varchar',
    length: 280,
    nullable: true,
  })
  victoryMessage?: string | null;

  @Column({
    name: 'defeat_message',
    type: 'varchar',
    length: 280,
    nullable: true,
  })
  defeatMessage?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'public' })
  visibility!: SocialProfileVisibility;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
