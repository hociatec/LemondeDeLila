import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../read-models/bug-report.record';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';

export class ListBugReportsService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly normalizer: BugReportStatusNormalizerService,
  ) {}

  async execute(
    options: {
      offset?: number;
      limit?: number;
      search?: string;
      status?: BugReportRecord['status'];
    } = {},
  ): Promise<BugReportRecord[]> {
    const offsetInput = options.offset ?? 0;
    const limitInput = options.limit ?? 50;
    const offset = Number.isSafeInteger(offsetInput)
      ? Math.min(10_000_000, Math.max(0, offsetInput))
      : 0;
    const limit = Number.isSafeInteger(limitInput)
      ? Math.max(1, Math.min(100, limitInput))
      : 50;
    const search = normalizeSearch(options.search);
    const status = options.status
      ? this.normalizer.normalizeStatus(options.status)
      : undefined;
    const items = await this.repo.list({
      offset,
      limit,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });
    return items.map((item) => this.normalizer.normalizeRecord(item));
  }
}

function normalizeSearch(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}
