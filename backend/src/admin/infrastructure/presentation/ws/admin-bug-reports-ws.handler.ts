import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { AdminBugReportsService } from '../../../application/use-cases/admin-bug-reports/admin-bug-reports.service';
import {
  AdminBugReportCreateWsDto,
  AdminBugReportIdWsDto,
  AdminBugReportsListWsDto,
  AdminBugReportUpdateWsDto,
  AdminBugReportUpdateStatusWsDto,
} from './dto/admin-bug-reports.ws.dto';

@Injectable()
export class AdminBugReportsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly bugReports: AdminBugReportsService,
  ) {}

  async create(session: WsSession, payload: unknown) {
    const user = requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportCreateWsDto, payload);
    const report = await this.bugReports.create({
      subject: dto.subject,
      content: dto.content,
      createdByUserId: user.id,
      createdByUsername: user.username,
    });
    return { type: WS_EVENTS.admin.bugReports.create, payload: { report } };
  }

  async list(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminBugReportsListWsDto, payload ?? {});
    const items = await this.bugReports.list();
    return { type: WS_EVENTS.admin.bugReports.list, payload: { items } };
  }

  async get(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportIdWsDto, payload);
    const report = await this.bugReports.get(dto.id);
    return {
      type: WS_EVENTS.admin.bugReports.get,
      payload: { report },
    };
  }

  async update(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportUpdateWsDto, payload);
    const report = await this.bugReports.update({
      id: dto.id,
      subject: dto.subject,
      content: dto.content,
    });
    return { type: WS_EVENTS.admin.bugReports.update, payload: { report } };
  }

  async updateStatus(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminBugReportUpdateStatusWsDto,
      payload,
    );
    const report = await this.bugReports.updateStatus({
      id: dto.id,
      status: dto.status,
    });
    return {
      type: WS_EVENTS.admin.bugReports.updateStatus,
      payload: { report },
    };
  }

  async delete(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportIdWsDto, payload);
    const result = await this.bugReports.delete(dto.id);
    return { type: WS_EVENTS.admin.bugReports.delete, payload: result };
  }
}

