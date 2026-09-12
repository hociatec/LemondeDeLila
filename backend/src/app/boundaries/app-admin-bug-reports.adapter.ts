import { Injectable } from '@nestjs/common';
import {
  AddBugReportCommentService,
  CountBugReportCommentsService,
  CreateBugReportService,
  DeleteBugReportService,
  GetBugReportService,
  ListBugReportCommentsService,
  ListBugReportsService,
  UpdateBugReportService,
  UpdateBugReportStatusService,
} from '../../modules/bug-reports/public-api';
import type { AdminBugReportsPort } from '../../modules/admin/public-api';
import type {
  BugReportCommentRecord,
  BugReportRecord,
  BugReportStatus,
} from '../../modules/bug-reports/public-api';

@Injectable()
export class AppAdminBugReportsAdapter implements AdminBugReportsPort {
  constructor(
    private readonly createReport: CreateBugReportService,
    private readonly listReports: ListBugReportsService,
    private readonly getReport: GetBugReportService,
    private readonly updateReport: UpdateBugReportService,
    private readonly updateStatusService: UpdateBugReportStatusService,
    private readonly deleteReport: DeleteBugReportService,
    private readonly listCommentsService: ListBugReportCommentsService,
    private readonly addCommentService: AddBugReportCommentService,
    private readonly countCommentsService: CountBugReportCommentsService,
  ) {}

  create(input: {
    subject: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportRecord> {
    return this.createReport.execute(input);
  }

  list(options: {
    offset?: number;
    limit?: number;
  }): Promise<BugReportRecord[]> {
    return this.listReports.execute(options);
  }

  get(id: string): Promise<BugReportRecord | null> {
    return this.getReport.execute(id);
  }

  update(
    id: string,
    patch: { subject?: string; content?: string },
  ): Promise<BugReportRecord | null> {
    return this.updateReport.execute(id, patch);
  }

  updateStatus(
    id: string,
    status: BugReportStatus,
  ): Promise<BugReportRecord | null> {
    return this.updateStatusService.execute(id, status);
  }

  delete(id: string): Promise<boolean> {
    return this.deleteReport.execute(id);
  }

  listComments(
    reportId: string,
    options: { offset?: number; limit?: number },
  ): Promise<BugReportCommentRecord[]> {
    return this.listCommentsService.execute(reportId, options);
  }

  addComment(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }): Promise<BugReportCommentRecord | null> {
    return this.addCommentService.execute(input);
  }

  countComments(reportIds: string[]): Promise<Record<string, number>> {
    return this.countCommentsService.execute(reportIds);
  }
}
