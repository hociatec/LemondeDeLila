import type {
  BugReportRecord,
  BugReportStatus,
} from '../models/bug-report.record';
import type { BugReportCommentRecord } from '../models/bug-report-comment.record';

export interface CreateBugReportRecordInput {
  id: string;
  subject: string;
  content: string;
  status: BugReportStatus;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: number;
  createdByUsername: string;
}

export interface CreateBugReportCommentRecordInput {
  id: string;
  reportId: string;
  content: string;
  createdAt: Date;
  createdByUserId: number;
  createdByUsername: string;
}

export interface BugReportRepository {
  list(): Promise<BugReportRecord[]>;
  findById(id: string): Promise<BugReportRecord | null>;
  save(
    report: CreateBugReportRecordInput | BugReportRecord,
  ): Promise<BugReportRecord>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

export interface BugReportCommentRepository {
  countByReportIds(reportIds: string[]): Promise<Record<string, number>>;
  listByReportId(reportId: string): Promise<BugReportCommentRecord[]>;
  save(
    comment: CreateBugReportCommentRecordInput | BugReportCommentRecord,
  ): Promise<BugReportCommentRecord>;
}

export const BUG_REPORT_REPOSITORY = Symbol('BUG_REPORT_REPOSITORY');
export const BUG_REPORT_COMMENT_REPOSITORY = Symbol(
  'BUG_REPORT_COMMENT_REPOSITORY',
);
