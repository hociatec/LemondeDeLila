import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import type { BugReportRepository } from '../../ports/bug-report.repository';
import type {
  BugReportRecord,
  BugReportStatus,
} from '../../read-models/bug-report.record';
import { businessMsToDate } from '../../../../../shared/utils/public-api';

const MAX_BUG_REPORT_SUBJECT_LENGTH = 200;
const MAX_BUG_REPORT_CONTENT_LENGTH = 20_000;
const MAX_BUG_REPORT_USERNAME_LENGTH = 100;

@Injectable()
export class CreateBugReportService {
  constructor(
    private readonly repo: BugReportRepository,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(input: {
    subject: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportRecord> {
    const now = businessMsToDate(this.clock.now());
    const subject = String(input.subject ?? '').trim();
    const content = String(input.content ?? '').trim();
    const createdByUsername =
      String(input.createdByUsername ?? '').trim() || 'admin';
    if (
      subject.length > MAX_BUG_REPORT_SUBJECT_LENGTH ||
      content.length > MAX_BUG_REPORT_CONTENT_LENGTH ||
      createdByUsername.length > MAX_BUG_REPORT_USERNAME_LENGTH ||
      !Number.isSafeInteger(input.createdByUserId) ||
      input.createdByUserId <= 0
    ) {
      throw new Error('Données de signalement invalides.');
    }
    return this.repo.save({
      id: randomUUID(),
      subject,
      content,
      status: 'pending' satisfies BugReportStatus,
      createdByUserId: input.createdByUserId,
      createdByUsername,
      createdAt: now,
      updatedAt: now,
    });
  }
}
