import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportStatus } from '../../read-models/bug-report.record';

export class CountBugReportsByStatusService {
  constructor(private readonly repo: BugReportRepository) {}

  execute(): Promise<Record<BugReportStatus, number>> {
    return this.repo.countByStatus();
  }
}
