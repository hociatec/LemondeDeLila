import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BugReportStatus } from '../../../../application/models/bug-report.record';

@Entity({ name: 'bug_reports' })
@Index('idx_bug_reports_status', ['status'])
@Index('idx_bug_reports_created_at', ['createdAt'])
export class BugReportEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  subject!: string;

  @Column({ type: 'longtext' })
  content!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: BugReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'created_by_user_id', type: 'int' })
  createdByUserId!: number;

  @Column({ name: 'created_by_username', type: 'varchar', length: 100 })
  createdByUsername!: string;
}
