import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../read-models/bug-report.record';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';

export class ListBugReportsService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly normalizer: BugReportStatusNormalizerService,
  ) {}

  async execute(
    options: { offset?: number; limit?: number } = {},
  ): Promise<BugReportRecord[]> {
    const offsetInput = options.offset ?? 0;
    const limitInput = options.limit ?? 50;
    const offset = Number.isSafeInteger(offsetInput)
      ? Math.min(10_000_000, Math.max(0, offsetInput))
      : 0;
    const limit = Number.isSafeInteger(limitInput)
      ? Math.max(1, Math.min(100, limitInput))
      : 50;
    const items = await this.repo.list({ offset, limit });
    return items.map((item) => this.normalizer.normalizeRecord(item));
  }
}
