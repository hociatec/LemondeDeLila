import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'bug_report_comments' })
@Index('idx_bug_report_comments_report_id', ['reportId'])
@Index('idx_bug_report_comments_created_at', ['createdAt'])
export class BugReportCommentEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'report_id', type: 'varchar', length: 36 })
  reportId!: string;

  @Column({ type: 'longtext' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'created_by_user_id', type: 'int' })
  createdByUserId!: number;

  @Column({ name: 'created_by_username', type: 'varchar', length: 100 })
  createdByUsername!: string;
}

