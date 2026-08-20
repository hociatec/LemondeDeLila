import { BadRequestException, Injectable } from '@nestjs/common';
import { CountBugReportCommentsService } from '../../../../bug-reports/application/use-cases/bug-report-comments/count-bug-report-comments.service';
import { CreateBugReportService } from '../../../../bug-reports/application/use-cases/bug-reports/create-bug-report.service';
import { DeleteBugReportService } from '../../../../bug-reports/application/use-cases/bug-reports/delete-bug-report.service';
import { GetBugReportService } from '../../../../bug-reports/application/use-cases/bug-reports/get-bug-report.service';
import { ListBugReportsService } from '../../../../bug-reports/application/use-cases/bug-reports/list-bug-reports.service';
import { UpdateBugReportService } from '../../../../bug-reports/application/use-cases/bug-reports/update-bug-report.service';
import { UpdateBugReportStatusService } from '../../../../bug-reports/application/use-cases/bug-reports/update-bug-report-status.service';

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
    | 'pending'
    | 'in_progress'
    | 'to_test'
    | 'done'
    | 'refused'
    | 'rejected';
}

@Injectable()
export class AdminBugReportsService {
  constructor(
    private readonly createBugReport: CreateBugReportService,
    private readonly listBugReports: ListBugReportsService,
    private readonly getBugReport: GetBugReportService,
    private readonly updateBugReport: UpdateBugReportService,
    private readonly updateBugReportStatus: UpdateBugReportStatusService,
    private readonly deleteBugReport: DeleteBugReportService,
    private readonly countBugReportComments: CountBugReportCommentsService,
  ) {}

  async create(command: CreateAdminBugReportCommand) {
    return this.createBugReport.execute({
      subject: command.subject,
      content: command.content,
      createdByUserId: command.createdByUserId,
      createdByUsername: command.createdByUsername,
    });
  }

  async list() {
    const items = await this.listBugReports.execute();
    const counts = await this.countBugReportComments.execute(
      items.map((item) => item.id),
    );
    return items.map((item) => ({
      ...item,
      commentsCount: counts[item.id] ?? 0,
    }));
  }

  async get(id: string) {
    const report = await this.getBugReport.execute(id);
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    const counts = await this.countBugReportComments.execute([report.id]);
    return {
      ...report,
      commentsCount: counts[report.id] ?? 0,
    };
  }

  async update(command: UpdateAdminBugReportCommand) {
    const report = await this.updateBugReport.execute(command.id, {
      subject: command.subject,
      content: command.content,
    });
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    return report;
  }

  async updateStatus(command: UpdateAdminBugReportStatusCommand) {
    const report = await this.updateBugReportStatus.execute(
      command.id,
      command.status,
    );
    if (!report) {
      throw new BadRequestException('Rapport introuvable');
    }
    return report;
  }

  async delete(id: string) {
    const ok = await this.deleteBugReport.execute(id);
    if (!ok) {
      throw new BadRequestException('Rapport introuvable');
    }
    return { removed: true };
  }
}
