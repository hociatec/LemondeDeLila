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

  async countByReportIds(reportIds: string[]): Promise<Record<string, number>> {
    const ids = Array.from(
      new Set(
        (reportIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean),
      ),
    );
    if (ids.length === 0) return {};

    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.reportId', 'reportId')
      .addSelect('COUNT(*)', 'count')
      .where('c.reportId IN (:...ids)', { ids })
      .groupBy('c.reportId')
      .getRawMany<{ reportId: string; count: string }>();

    const out: Record<string, number> = {};
    for (const row of rows) {
      const reportId = String(row.reportId ?? '').trim();
      if (!reportId) continue;
      const count = Number(row.count ?? 0);
      out[reportId] = Number.isFinite(count) ? count : 0;
    }
    return out;
  }

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
