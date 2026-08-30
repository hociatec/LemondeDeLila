import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../contracts/bug-report.record';
import { GetBugReportService } from './get-bug-report.service';

export class UpdateBugReportService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly getBugReport: GetBugReportService,
  ) {}

  async execute(
    id: string,
    patch: { subject?: string; content?: string },
  ): Promise<BugReportRecord | null> {
    const current = await this.getBugReport.execute(id);
    if (!current) return null;

    if (typeof patch.subject === 'string') {
      current.subject = patch.subject.trim();
    }
    if (typeof patch.content === 'string') {
      current.content = patch.content.trim();
    }
    return this.repo.save(current);
  }
}
