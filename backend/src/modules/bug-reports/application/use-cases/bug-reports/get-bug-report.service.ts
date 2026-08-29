import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../models/bug-report.record';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';

export class GetBugReportService {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly normalizer: BugReportStatusNormalizerService,
  ) {}

  async execute(id: string): Promise<BugReportRecord | null> {
    const key = String(id ?? '').trim();
    if (!key) return null;

    const report = await this.repo.findById(key);
    if (!report) return null;
    return this.normalizer.normalizeRecord(report);
  }
}
