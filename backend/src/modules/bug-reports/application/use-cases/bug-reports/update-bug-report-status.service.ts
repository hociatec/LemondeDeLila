import type { BugReportRepository } from '../../ports/bug-report.repository';
import type {
  BugReportRecord,
  BugReportStatus,
} from '../../contracts/bug-report.record';
import { GetBugReportService } from './get-bug-report.service';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';

export class UpdateBugReportStatusService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly getBugReport: GetBugReportService,
    private readonly normalizer: BugReportStatusNormalizerService,
  ) {}

  async execute(
    id: string,
    status: BugReportStatus,
  ): Promise<BugReportRecord | null> {
    const current = await this.getBugReport.execute(id);
    if (!current) return null;
    current.status = this.normalizer.normalizeStatus(status);
    return this.repo.save(current);
  }
}
