import { BadRequestException, Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { BugReportCommentsService } from '../../../../bug-reports/bug-report-comments.service';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import {
  AdminBugReportCommentAddWsDto,
  AdminBugReportCommentsListWsDto,
} from './admin-bug-report-comments.dto';

@Injectable()
export class AdminBugReportCommentsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly comments: BugReportCommentsService,
  ) {}

  async list(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminBugReportCommentsListWsDto,
      payload,
    );
    const items = await this.comments.listByReportId(dto.reportId);
    return { type: WS_EVENTS.admin.bugReports.commentsList, payload: { items } };
  }

  async add(session: WsSession, payload: any) {
    const user = requireAdmin(session);
    const dto = this.validator.validate(AdminBugReportCommentAddWsDto, payload);
    const reportId = dto.reportId.trim();
    const comment = await this.comments.add({
      reportId,
      content: dto.content,
      createdByUserId: user.id,
      createdByUsername: user.username,
    });
    if (!comment) {
      throw new BadRequestException('Rapport introuvable');
    }
    const counts = await this.comments.countByReportIds([reportId]);
    return {
      type: WS_EVENTS.admin.bugReports.commentsAdd,
      payload: {
        comment,
        reportId,
        commentsCount: counts[reportId] ?? 0,
      },
    };
  }
}





