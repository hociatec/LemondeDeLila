import type { BugReportCommentRepository } from '../../ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../models/bug-report-comment.record';

export class ListBugReportCommentsService {
  constructor(private readonly repo: BugReportCommentRepository) {}

  async execute(reportId: string): Promise<BugReportCommentRecord[]> {
    const id = String(reportId ?? '').trim();
    if (!id) return [];
    return this.repo.listByReportId(id);
  }
}
