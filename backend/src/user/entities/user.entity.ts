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

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
