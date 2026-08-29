import { randomUUID } from 'crypto';
import type {
  BugReportCommentRepository,
  BugReportRepository,
} from '../../ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../models/bug-report-comment.record';

export class AddBugReportCommentService {
  constructor(
    private readonly repo: BugReportCommentRepository,
    private readonly reports: BugReportRepository,
  ) {}

  async execute(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportCommentRecord | null> {
    const reportId = String(input.reportId ?? '').trim();
    if (!reportId) return null;
    if (!(await this.reports.exists(reportId))) return null;

    const now = new Date();
    return this.repo.save({
      id: randomUUID(),
      reportId,
      content: String(input.content ?? '').trim(),
      createdByUserId: Number(input.createdByUserId || 0),
      createdByUsername:
        String(input.createdByUsername ?? '').trim() || 'admin',
      createdAt: now,
    });
  }
}
