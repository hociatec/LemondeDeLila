import type { BugReportRepository } from '../../ports/bug-report.repository';

export class DeleteBugReportService {
  constructor(private readonly repo: BugReportRepository) {}

  async execute(id: string): Promise<boolean> {
    const key = String(id ?? '').trim();
    if (!key) return false;
    return this.repo.delete(key);
  }
}
