import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import type {
  BugReportCommentRepository,
  BugReportRepository,
} from '../../ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../read-models/bug-report-comment.record';
import { businessMsToDate } from '../../../../../shared/utils/public-api';

const MAX_BUG_REPORT_COMMENT_LENGTH = 20_000;
const MAX_BUG_REPORT_USERNAME_LENGTH = 100;

@Injectable()
export class AddBugReportCommentService {
  constructor(
    private readonly repo: BugReportCommentRepository,
    private readonly reports: BugReportRepository,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportCommentRecord | null> {
    const reportId = String(input.reportId ?? '').trim();
    if (!reportId || reportId.length > 64) return null;
    if (!(await this.reports.exists(reportId))) return null;

    const now = businessMsToDate(this.clock.now());
    const content = String(input.content ?? '').trim();
    const createdByUsername =
      String(input.createdByUsername ?? '').trim() || 'admin';
    if (
      content.length > MAX_BUG_REPORT_COMMENT_LENGTH ||
      createdByUsername.length > MAX_BUG_REPORT_USERNAME_LENGTH ||
      !Number.isSafeInteger(input.createdByUserId) ||
      input.createdByUserId <= 0
    ) {
      throw new Error('Données de commentaire invalides.');
    }
    return this.repo.save({
      id: randomUUID(),
      reportId,
      content,
      createdByUserId: input.createdByUserId,
      createdByUsername,
      createdAt: now,
    });
  }
}
