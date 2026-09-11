import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  BugReportRepository,
  CreateBugReportRecordInput,
} from '../../../../application/ports/bug-report.repository';
import type { BugReportRecord } from '../../../../application/read-models/bug-report.record';
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
  }): Promise<BugReportRecord[]> {
    const offset = normalizeOffset(options.offset);
    const limit = normalizeLimit(options.limit);
    const items = await this.repo.find({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: offset,
      take: limit,
    });
    return items.map((item) => this.toRecord(item));
  }

  async findById(id: string): Promise<BugReportRecord | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toRecord(item) : null;
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
