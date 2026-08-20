import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../models/bug-report.record';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';

export class ListBugReportsService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly normalizer: BugReportStatusNormalizerService,
  ) {}

  async execute(): Promise<BugReportRecord[]> {
    const items = await this.repo.list();
    return items.map((item) => this.normalizer.normalizeRecord(item));
  }
}
