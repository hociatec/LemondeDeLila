import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { BugReportEntity } from './entities/bug-report.entity';
import { BugReportCommentEntity } from './entities/bug-report-comment.entity';

@Injectable()
export class BugReportCommentsService {
  constructor(
    @InjectRepository(BugReportCommentEntity)
    private readonly repo: Repository<BugReportCommentEntity>,
    @InjectRepository(BugReportEntity)
    private readonly reports: Repository<BugReportEntity>,
  ) {}

  listByReportId(reportId: string): Promise<BugReportCommentEntity[]> {
    const id = String(reportId ?? '').trim();
    if (!id) return Promise.resolve([]);
    return this.repo.find({
      where: { reportId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async add(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportCommentEntity | null> {
    const reportId = String(input.reportId ?? '').trim();
    if (!reportId) return null;
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) return null;

    const now = new Date();
    const entity = this.repo.create({
      id: randomUUID(),
      reportId,
      content: String(input.content ?? '').trim(),
      createdByUserId: Number(input.createdByUserId || 0),
      createdByUsername:
        String(input.createdByUsername ?? '').trim() || 'admin',
      createdAt: now,
    });
    return this.repo.save(entity);
  }
}
