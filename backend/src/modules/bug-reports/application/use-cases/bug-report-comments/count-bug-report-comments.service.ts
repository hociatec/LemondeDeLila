import type { BugReportCommentRepository } from '../../ports/bug-report.repository';

export class CountBugReportCommentsService {
  constructor(private readonly repo: BugReportCommentRepository) {}

  async execute(reportIds: string[]): Promise<Record<string, number>> {
    const ids = Array.from(
      new Set(
        (reportIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean),
      ),
    );
    if (ids.length === 0) return {};

    return this.repo.countByReportIds(ids);
  }
}
