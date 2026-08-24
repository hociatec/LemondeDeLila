import { BadRequestException, Injectable } from '@nestjs/common';
import { AddBugReportCommentService } from '../../../../bug-reports/public-api';
import { CountBugReportCommentsService } from '../../../../bug-reports/public-api';
import { ListBugReportCommentsService } from '../../../../bug-reports/public-api';

@Injectable()
export class AdminBugReportCommentsService {
  constructor(
    private readonly listBugReportComments: ListBugReportCommentsService,
    private readonly addBugReportComment: AddBugReportCommentService,
    private readonly countBugReportComments: CountBugReportCommentsService,
  ) {}

  list(reportId: string) {
    return this.listBugReportComments.execute(reportId);
  }

  async add(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }) {
    const reportId = input.reportId.trim();
    const comment = await this.addBugReportComment.execute({
      reportId,
      content: input.content,
      createdByUserId: input.createdByUserId,
      createdByUsername: input.createdByUsername,
    });

    if (!comment) {
      throw new BadRequestException('Rapport introuvable');
    }

    const counts = await this.countBugReportComments.execute([reportId]);
    return {
      comment,
      reportId,
      commentsCount: counts[reportId] ?? 0,
    };
  }
}
