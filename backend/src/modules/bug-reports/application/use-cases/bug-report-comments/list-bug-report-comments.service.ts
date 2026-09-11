import type { BugReportCommentRepository } from '../../ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../read-models/bug-report-comment.record';

export class ListBugReportCommentsService {
  constructor(private readonly repo: BugReportCommentRepository) {}

  async execute(
    reportId: string,
    options: { offset?: number; limit?: number } = {},
  ): Promise<BugReportCommentRecord[]> {
    const id = String(reportId ?? '').trim();
    if (!id) return [];
    const offsetInput = options.offset ?? 0;
    const limitInput = options.limit ?? 50;
    const offset = Number.isSafeInteger(offsetInput)
      ? Math.min(10_000_000, Math.max(0, offsetInput))
      : 0;
    const limit = Number.isSafeInteger(limitInput)
      ? Math.max(1, Math.min(100, limitInput))
      : 50;
    return this.repo.listByReportId(id, { offset, limit });
  }
}
