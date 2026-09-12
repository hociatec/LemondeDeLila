import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_BUG_REPORTS_PORT,
  type AdminBugReportsPort,
} from '../../ports/admin-bug-reports.port';

export interface CreateAdminBugReportCommand {
  subject: string;
  content: string;
  createdByUserId: number;
  createdByUsername: string;
}

export interface UpdateAdminBugReportCommand {
  id: string;
  subject?: string;
  content?: string;
}

export interface UpdateAdminBugReportStatusCommand {
  id: string;
  status:
    'pending' | 'in_progress' | 'to_test' | 'done' | 'refused' | 'rejected';
}

@Injectable()
export class AdminBugReportsService {
  constructor(
    @Inject(ADMIN_BUG_REPORTS_PORT)
    private readonly bugReports: AdminBugReportsPort,
  ) {}

  async create(command: CreateAdminBugReportCommand) {
    assertText(command.subject, 200, 'Sujet invalide');
    assertText(command.content, 20_000, 'Contenu invalide');
    assertUserId(command.createdByUserId);
    assertText(command.createdByUsername, 100, "Nom d'utilisateur invalide");
    return this.bugReports.create({
      subject: command.subject,
      content: command.content,
      createdByUserId: command.createdByUserId,
      createdByUsername: command.createdByUsername,
    });
  }

  async list(options: { offset?: number; limit?: number } = {}) {
    const offset = normalizeOffset(options.offset);
    const limit = normalizeLimit(options.limit);
    const items = await this.bugReports.list({ offset, limit });
    const counts = await this.bugReports.countComments(
      items.map((item) => item.id),
    );
    return items.map((item) => ({
      ...item,
      commentsCount: counts[item.id] ?? 0,
    }));
  }

  async get(id: string) {
    assertReportId(id);
    const report = await this.bugReports.get(id);
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    const counts = await this.bugReports.countComments([report.id]);
    return {
      ...report,
      commentsCount: counts[report.id] ?? 0,
    };
  }

  async update(command: UpdateAdminBugReportCommand) {
    assertReportId(command.id);
    if (command.subject !== undefined) {
      assertText(command.subject, 200, 'Sujet invalide');
    }
    if (command.content !== undefined) {
      assertText(command.content, 20_000, 'Contenu invalide');
    }
    const report = await this.bugReports.update(command.id, {
      subject: command.subject,
      content: command.content,
    });
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    return report;
  }

  async updateStatus(command: UpdateAdminBugReportStatusCommand) {
    assertReportId(command.id);
    if (
      ![
        'pending',
        'in_progress',
        'to_test',
        'done',
        'refused',
        'rejected',
      ].includes(command.status)
    ) {
      throw new BadRequestException('Statut de rapport invalide');
    }
    const report = await this.bugReports.updateStatus(
      command.id,
      command.status,
    );
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    return report;
  }

  async delete(id: string) {
    assertReportId(id);
    const ok = await this.bugReports.delete(id);
    if (!ok) {
      throw new BadRequestException('Rapport introuvable');
    }
    return { removed: true };
  }
}

function assertReportId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) {
    throw new BadRequestException('Identifiant de rapport invalide');
  }
}

function assertUserId(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException('Identifiant utilisateur invalide');
  }
}

function assertText(
  value: unknown,
  maxLength: number,
  message: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw new BadRequestException(message);
  }
}

function normalizeOffset(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? Math.min(10_000_000, value as number)
    : 0;
}

function normalizeLimit(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) > 0
    ? Math.min(100, value as number)
    : 50;
}
