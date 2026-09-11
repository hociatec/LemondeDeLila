import type {
  BugReportRecord,
  BugReportStatus,
} from '../../../bug-reports/public-api';
import type { BugReportCommentRecord } from '../../../bug-reports/public-api';

export const ADMIN_BUG_REPORTS_PORT = Symbol('ADMIN_BUG_REPORTS_PORT');

export interface AdminBugReportsPort {
  create(input: {
    subject: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportRecord>;
  list(options: { offset?: number; limit?: number }): Promise<BugReportRecord[]>;
  get(id: string): Promise<BugReportRecord | null>;
  update(
    id: string,
    patch: { subject?: string; content?: string },
  ): Promise<BugReportRecord | null>;
  updateStatus(
    id: string,
    status: BugReportStatus,
  ): Promise<BugReportRecord | null>;
  delete(id: string): Promise<boolean>;
  listComments(
    reportId: string,
    options: { offset?: number; limit?: number },
  ): Promise<BugReportCommentRecord[]>;
  addComment(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportCommentRecord | null>;
  countComments(reportIds: string[]): Promise<Record<string, number>>;
}
