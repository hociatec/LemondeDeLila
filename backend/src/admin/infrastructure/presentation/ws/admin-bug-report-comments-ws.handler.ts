import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { AdminBugReportCommentsService } from '../../../application/use-cases/admin-bug-reports/admin-bug-report-comments.service';
import { WS_EVENTS } from '../../../../realtime/public-api';
import {
  AdminBugReportCommentAddWsDto,
  AdminBugReportCommentsListWsDto,
} from './dto/admin-bug-report-comments.ws.dto';

@Injectable()
export class AdminBugReportCommentsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly comments: AdminBugReportCommentsService,
  ) {}

  async list(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminBugReportCommentsListWsDto,
      payload,
    );
    const items = await this.comments.list(dto.reportId);
    return { type: WS_EVENTS.admin.bugReports.commentsList, payload: { items } };
  }

  async add(session: WsSession, payload: unknown) {
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






