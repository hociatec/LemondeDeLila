import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { BugReportEntity, BugReportStatus } from './entities/bug-report.entity';

@Injectable()
export class BugReportsService {
  constructor(
    @InjectRepository(BugReportEntity)
    private readonly repo: Repository<BugReportEntity>,
  ) {}

  list(): Promise<BugReportEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  get(id: string): Promise<BugReportEntity | null> {
    const key = (id || '').trim();
    if (!key) return Promise.resolve(null);
    return this.repo.findOne({ where: { id: key } });
  }

  async create(input: {
    subject: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportEntity> {
    const now = new Date();
    const entity = this.repo.create({
      id: randomUUID(),
      subject: (input.subject || '').trim(),
      content: (input.content || '').trim(),
      status: 'pending' satisfies BugReportStatus,
      createdByUserId: Number(input.createdByUserId || 0),
      createdByUsername: (input.createdByUsername || '').trim() || 'admin',
      createdAt: now,
      updatedAt: now,
    });
    return this.repo.save(entity);
  }

  async update(id: string, patch: { subject?: string; content?: string }): Promise<BugReportEntity | null> {
    const current = await this.get(id);
    if (!current) return null;

    if (typeof patch.subject === 'string') {
      current.subject = patch.subject.trim();
    }
    if (typeof patch.content === 'string') {
      current.content = patch.content.trim();
    }
    return this.repo.save(current);
  }

  async updateStatus(id: string, status: BugReportStatus): Promise<BugReportEntity | null> {
    const current = await this.get(id);
    if (!current) return null;
    current.status = status;
    return this.repo.save(current);
  }

  async delete(id: string): Promise<boolean> {
    const key = (id || '').trim();
    if (!key) return false;
    const res = await this.repo.delete({ id: key });
    return Boolean(res.affected && res.affected > 0);
  }
}

