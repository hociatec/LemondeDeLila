import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../../../user/public-api';

export type SocialRelationshipStatus = 'pending' | 'accepted' | 'blocked';

@Entity({ name: 'social_relationships' })
@Unique('uniq_social_relationship_status', ['requester', 'addressee', 'status'])
@Index('idx_social_relationship_status', ['status'])
@Index('idx_social_relationship_requester', ['requester'])
@Index('idx_social_relationship_addressee', ['addressee'])
@Index('idx_social_relationship_requester_status_updated', [
  'requester',
  'status',
  'updatedAt',
])
@Index('idx_social_relationship_addressee_status_updated', [
  'addressee',
  'status',
  'updatedAt',
])
export class SocialRelationshipEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester!: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addressee_id' })
  addressee!: User;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: SocialRelationshipStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
