import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  BugReportCommentRepository,
  CreateBugReportCommentRecordInput,
} from '../../../../application/ports/bug-report.repository';
import type { BugReportCommentRecord } from '../../../../application/read-models/bug-report-comment.record';
import { BugReportCommentEntity } from '../entities/bug-report-comment.entity';

const MAX_COMMENT_PAGE_SIZE = 100;
const MAX_COMMENT_OFFSET = 10_000_000;

@Injectable()
export class BugReportCommentTypeormRepository implements BugReportCommentRepository {
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
      .limit(Math.min(reportIds.length, 500))
      .getRawMany<{ reportId: string; count: string }>();

    const output: Record<string, number> = {};
    for (const row of rows) {
      const reportId = String(row.reportId ?? '').trim();
      if (!reportId) {
        continue;
      }
      const count = Number(row.count ?? 0);
      output[reportId] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
    }
    return output;
  }

  async listByReportId(
    reportId: string,
    options: { offset: number; limit: number },
  ): Promise<BugReportCommentRecord[]> {
    const offset = normalizeOffset(options.offset);
    const limit = normalizeLimit(options.limit);
    const items = await this.repo.find({
      where: { reportId },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: offset,
      take: limit,
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

function normalizeOffset(value: number): number {
  return Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, MAX_COMMENT_OFFSET)
    : 0;
}

function normalizeLimit(value: number): number {
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, MAX_COMMENT_PAGE_SIZE)
    : MAX_COMMENT_PAGE_SIZE;
}
