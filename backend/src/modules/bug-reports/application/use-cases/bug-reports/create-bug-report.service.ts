import { randomUUID } from 'crypto';
import type { BugReportRepository } from '../../ports/bug-report.repository';
import type {
  BugReportRecord,
  BugReportStatus,
} from '../../models/bug-report.record';

export class CreateBugReportService {
  constructor(private readonly repo: BugReportRepository) {}

  async execute(input: {
    subject: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportRecord> {
    const now = new Date();
    return this.repo.save({
      id: randomUUID(),
      subject: String(input.subject ?? '').trim(),
      content: String(input.content ?? '').trim(),
      status: 'pending' satisfies BugReportStatus,
      createdByUserId: Number(input.createdByUserId || 0),
      createdByUsername:
        String(input.createdByUsername ?? '').trim() || 'admin',
      createdAt: now,
      updatedAt: now,
    });
  }
}
