import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../../../../user/public-api';

@Entity({ name: 'messaging_private_messages' })
@Unique('uniq_messaging_private_messages_message_id', ['messageId'])
@Index('idx_messaging_private_messages_created_at', ['createdAt'])
@Index('idx_messaging_private_messages_sender', ['sender'])
@Index('idx_messaging_private_messages_recipient', ['recipient'])
@Index('idx_messaging_private_messages_sender_created', ['sender', 'createdAt'])
@Index('idx_messaging_private_messages_recipient_created', [
  'recipient',
  'createdAt',
])
export class PrivateMessageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: User;

  @Column({ name: 'message_id', type: 'varchar', length: 36, unique: true })
  messageId!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subject?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_by_sender_at', type: 'datetime', nullable: true })
  deletedBySenderAt?: Date | null;

  @Column({ name: 'deleted_by_recipient_at', type: 'datetime', nullable: true })
  deletedByRecipientAt?: Date | null;

  @Column({ name: 'read_by_recipient_at', type: 'datetime', nullable: true })
  readByRecipientAt?: Date | null;
}
