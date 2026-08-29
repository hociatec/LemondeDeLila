import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../models/bug-report.record';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';

export class ListBugReportsService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly normalizer: BugReportStatusNormalizerService,
  ) {}

  async execute(
    options: { offset?: number; limit?: number } = {},
  ): Promise<BugReportRecord[]> {
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
    const items = await this.repo.list({ offset, limit });
    return items.map((item) => this.normalizer.normalizeRecord(item));
  }
}
