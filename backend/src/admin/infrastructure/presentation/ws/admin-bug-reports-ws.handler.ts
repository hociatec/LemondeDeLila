import { BadRequestException, Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { BugReportsService } from '../../../../bug-reports/bug-reports.service';
import { BugReportCommentsService } from '../../../../bug-reports/bug-report-comments.service';
import type { BugReportEntity } from '../../../../bug-reports/entities/bug-report.entity';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import {
  AdminBugReportCreateWsDto,
  AdminBugReportIdWsDto,
  AdminBugReportsListWsDto,
  AdminBugReportUpdateWsDto,
  AdminBugReportUpdateStatusWsDto,
} from './admin-bug-reports.dto';

@Injectable()
export class AdminBugReportsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly reports: BugReportsService,
    private readonly comments: BugReportCommentsService,
  ) {}

  async create(session: WsSession, payload: any) {
    const user = requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportCreateWsDto, payload);
    const report = await this.reports.create({
      subject: dto.subject,
      content: dto.content,
      createdByUserId: user.id,
      createdByUsername: user.username,
    });
    return { type: WS_EVENTS.admin.bugReports.create, payload: { report } };
  }

  async list(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminBugReportsListWsDto, payload ?? {});
    const items = await this.reports.list();
    const counts = await this.comments.countByReportIds(items.map((r) => r.id));
    const withCounts = items.map((r: BugReportEntity) => ({
      ...r,
      commentsCount: counts[r.id] ?? 0,
    }));
    return { type: WS_EVENTS.admin.bugReports.list, payload: { items: withCounts } };
  }

  async get(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportIdWsDto, payload);
    const report = await this.reports.get(dto.id);
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    const counts = await this.comments.countByReportIds([report.id]);
    return {
      type: WS_EVENTS.admin.bugReports.get,
      payload: {
        report: { ...report, commentsCount: counts[report.id] ?? 0 },
      },
    };
  }

  async update(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportUpdateWsDto, payload);
    const report = await this.reports.update(dto.id, {
      subject: dto.subject,
      content: dto.content,
    });
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    return { type: WS_EVENTS.admin.bugReports.update, payload: { report } };
  }

  async updateStatus(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminBugReportUpdateStatusWsDto,
      payload,
    );
    const report = await this.reports.updateStatus(dto.id, dto.status);
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    return { type: WS_EVENTS.admin.bugReports.updateStatus, payload: { report } };
  }

  async delete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportIdWsDto, payload);
    const ok = await this.reports.delete(dto.id);
    if (!ok) {
      throw new BadRequestException('Rapport introuvable');
    }
    return { type: WS_EVENTS.admin.bugReports.delete, payload: { removed: true } };
  }
}





