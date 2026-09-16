import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  BugReportRepository,
  CreateBugReportRecordInput,
} from '../../../../application/ports/bug-report.repository';
import type {
  BugReportRecord,
  BugReportStatus,
} from '../../../../application/read-models/bug-report.record';
import { BugReportEntity } from '../entities/bug-report.entity';

const MAX_BUG_REPORT_PAGE_SIZE = 100;
const MAX_BUG_REPORT_OFFSET = 10_000_000;

@Injectable()
export class BugReportTypeormRepository implements BugReportRepository {
  constructor(
    @InjectRepository(BugReportEntity)
    private readonly repo: Repository<BugReportEntity>,
  ) {}

  async list(options: {
    offset: number;
    limit: number;
    search?: string;
    status?: BugReportStatus;
  }): Promise<BugReportRecord[]> {
    const offset = normalizeOffset(options.offset);
    const limit = normalizeLimit(options.limit);
    const query = this.repo
      .createQueryBuilder('report')
      .orderBy('report.createdAt', 'DESC')
      .addOrderBy('report.id', 'DESC')
      .skip(offset)
      .take(limit);
    const search = options.search?.trim();
    if (search) {
      query.andWhere(
        '(report.id LIKE :search OR report.subject LIKE :search OR report.content LIKE :search OR report.createdByUsername LIKE :search)',
        { search: `%${escapeLike(search)}%` },
      );
    }
    if (options.status === 'refused') {
      query.andWhere('report.status IN (:...statuses)', {
        statuses: ['refused', 'rejected'],
      });
    } else if (options.status) {
      query.andWhere('report.status = :status', { status: options.status });
    }
    const items = await query.getMany();
    return items.map((item) => this.toRecord(item));
  }

  async findById(id: string): Promise<BugReportRecord | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toRecord(item) : null;
  }

  async countByStatus(): Promise<Record<BugReportStatus, number>> {
    const rows = await this.repo
      .createQueryBuilder('report')
      .select(
        "CASE WHEN report.status = 'rejected' THEN 'refused' ELSE report.status END",
        'status',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy(
        "CASE WHEN report.status = 'rejected' THEN 'refused' ELSE report.status END",
      )
      .getRawMany<{ status: BugReportStatus; count: string }>();
    const counts: Record<BugReportStatus, number> = {
      pending: 0,
      in_progress: 0,
      to_test: 0,
      done: 0,
      refused: 0,
      rejected: 0,
    };
    for (const row of rows)
      if (row.status in counts) counts[row.status] = Number(row.count) || 0;
    return counts;
  }

  async save(
    report: CreateBugReportRecordInput | BugReportRecord,
  ): Promise<BugReportRecord> {
    const entity = this.repo.create(report);
    const saved = await this.repo.save(entity);
    return this.toRecord(saved);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id });
    return Boolean(result.affected && result.affected > 0);
  }

  exists(id: string): Promise<boolean> {
    return this.repo.exists({ where: { id } });
  }

  private toRecord(entity: BugReportEntity): BugReportRecord {
    return {
      id: entity.id,
      subject: entity.subject,
      content: entity.content,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdByUserId: entity.createdByUserId,
      createdByUsername: entity.createdByUsername,
    };
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function normalizeOffset(value: number): number {
  return Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, MAX_BUG_REPORT_OFFSET)
    : 0;
}

function normalizeLimit(value: number): number {
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, MAX_BUG_REPORT_PAGE_SIZE)
    : MAX_BUG_REPORT_PAGE_SIZE;
}
