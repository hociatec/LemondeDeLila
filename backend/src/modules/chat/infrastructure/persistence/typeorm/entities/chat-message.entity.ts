import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ChatUserPersistenceRef } from './chat-user.persistence-ref';

@Index('idx_chat_messages_created_at', ['createdAt'])
@Entity({ name: 'chat_messages' })
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne('User', { eager: true })
  @JoinColumn({ name: 'user_id' })
  user!: ChatUserPersistenceRef;

  @Column({ name: 'message_id', type: 'varchar', length: 36, unique: true })
  messageId!: string;

  @Column({ type: 'longtext' })
  message!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null = null;
}
