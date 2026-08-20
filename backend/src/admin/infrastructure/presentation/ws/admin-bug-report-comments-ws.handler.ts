import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminBugReportCommentsService } from '../../../application/use-cases/admin-bug-reports/admin-bug-report-comments.service';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import {
  AdminBugReportCommentAddWsDto,
  AdminBugReportCommentsListWsDto,
} from './admin-bug-report-comments.dto';

@Injectable()
export class AdminBugReportCommentsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly comments: AdminBugReportCommentsService,
  ) {}

  async list(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminBugReportCommentsListWsDto,
      payload,
    );
    const items = await this.comments.list(dto.reportId);
    return { type: WS_EVENTS.admin.bugReports.commentsList, payload: { items } };
  }

  async add(session: WsSession, payload: any) {
    const user = requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportCommentAddWsDto, payload);
    const result = await this.comments.add({
      reportId: dto.reportId,
      content: dto.content,
      createdByUserId: user.id,
      createdByUsername: user.username,
    });
    return {
      type: WS_EVENTS.admin.bugReports.commentsAdd,
      payload: result,
    };
  }
}





