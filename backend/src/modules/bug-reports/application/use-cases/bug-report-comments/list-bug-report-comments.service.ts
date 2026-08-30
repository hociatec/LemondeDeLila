import type { BugReportCommentRepository } from '../../ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../contracts/bug-report-comment.record';

export class ListBugReportCommentsService {
  constructor(private readonly repo: BugReportCommentRepository) {}

  async execute(
    reportId: string,
    options: { offset?: number; limit?: number } = {},
  ): Promise<BugReportCommentRecord[]> {
    const id = String(reportId ?? '').trim();
    if (!id) return [];
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
    return this.repo.listByReportId(id, { offset, limit });
  }
}
