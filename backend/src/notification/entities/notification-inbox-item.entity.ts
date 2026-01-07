import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity({ name: 'notification_inbox_items' })
@Index('idx_notification_inbox_user_created', ['user', 'createdAt'])
@Index('idx_notification_inbox_user_unread', ['user', 'readAt'])
@Index('idx_notification_inbox_user_deleted', ['user', 'deletedAt'])
export class NotificationInboxItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  kind!: string;

  @Column({ name: 'contact_id', type: 'varchar', length: 36, nullable: true })
  contactId?: string | null;

  @Column({ name: 'from_user_id', type: 'int', nullable: true })
  fromUserId?: number | null;

  @Column({
    name: 'from_username',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  fromUsername?: string | null;

  @Column({ name: 'to_user_id', type: 'int', nullable: true })
  toUserId?: number | null;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'json', nullable: true })
  payload?: any;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt?: Date | null;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt?: Date | null;
}
