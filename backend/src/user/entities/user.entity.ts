import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 180, unique: true })
  email!: string;

  @Column({ type: 'json' })
  roles!: string[];

  @Column()
  password!: string;

  @Column({ length: 100, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string | null;

  @Column({ type: 'json', nullable: true })
  preferences?: Record<string, unknown> | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'banned_until', type: 'datetime', nullable: true })
  bannedUntil?: Date | null;

  @Column({ name: 'ban_reason', type: 'varchar', length: 255, nullable: true })
  banReason?: string | null;

  @Column({ name: 'chat_banned_until', type: 'datetime', nullable: true })
  chatBannedUntil?: Date | null;

  @Column({ name: 'chat_ban_reason', type: 'varchar', length: 255, nullable: true })
  chatBanReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
