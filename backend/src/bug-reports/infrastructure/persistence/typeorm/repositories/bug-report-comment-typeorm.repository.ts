import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  BugReportCommentRepository,
  CreateBugReportCommentRecordInput,
} from '../../../../application/ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../../../application/models/bug-report-comment.record';
import { BugReportCommentEntity } from '../entities/bug-report-comment.entity';

@Injectable()
export class BugReportCommentTypeormRepository
  implements BugReportCommentRepository
{
  constructor(
    @InjectRepository(BugReportCommentEntity)
    private readonly repo: Repository<BugReportCommentEntity>,
  ) {}

  async countByReportIds(reportIds: string[]): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.reportId', 'reportId')
      .addSelect('COUNT(*)', 'count')
      .where('c.reportId IN (:...ids)', { ids: reportIds })
      .groupBy('c.reportId')
      .getRawMany<{ reportId: string; count: string }>();

    const output: Record<string, number> = {};
    for (const row of rows) {
      const reportId = String(row.reportId ?? '').trim();
      if (!reportId) {
        continue;
      }
      const count = Number(row.count ?? 0);
      output[reportId] = Number.isFinite(count) ? count : 0;
    }
    return output;
  }

  async listByReportId(reportId: string): Promise<BugReportCommentRecord[]> {
    const items = await this.repo.find({
      where: { reportId },
      order: { createdAt: 'ASC' },
    });
    return items.map((item) => this.toRecord(item));
  }

  async save(
    comment: CreateBugReportCommentRecordInput | BugReportCommentRecord,
  ): Promise<BugReportCommentRecord> {
    const entity = this.repo.create(comment);
    const saved = await this.repo.save(entity);
    return this.toRecord(saved);
  }

  private toRecord(entity: BugReportCommentEntity): BugReportCommentRecord {
    return {
      id: entity.id,
      reportId: entity.reportId,
      content: entity.content,
      createdAt: entity.createdAt,
      createdByUserId: entity.createdByUserId,
      createdByUsername: entity.createdByUsername,
    };
  }
}
