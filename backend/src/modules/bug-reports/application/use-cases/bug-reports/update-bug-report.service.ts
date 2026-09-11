import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../read-models/bug-report.record';
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
    if (typeof id !== 'string' || id.trim().length === 0 || id.length > 64) {
      return null;
    }
    const current = await this.getBugReport.execute(id);
    if (!current) return null;

    if (typeof patch.subject === 'string') {
      current.subject = patch.subject.trim().slice(0, 200);
    }
    if (typeof patch.content === 'string') {
      current.content = patch.content.trim().slice(0, 20_000);
    }
    return this.repo.save(current);
  }
}
