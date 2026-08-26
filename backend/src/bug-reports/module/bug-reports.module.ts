import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  type BugReportCommentRepository,
  BUG_REPORT_COMMENT_REPOSITORY,
  BUG_REPORT_REPOSITORY,
  type BugReportRepository,
} from '../application/ports/bug-report.repository';
import { AddBugReportCommentService } from '../application/use-cases/bug-report-comments/add-bug-report-comment.service';
import { CountBugReportCommentsService } from '../application/use-cases/bug-report-comments/count-bug-report-comments.service';
import { ListBugReportCommentsService } from '../application/use-cases/bug-report-comments/list-bug-report-comments.service';
import { BugReportStatusNormalizerService } from '../application/use-cases/bug-reports/bug-report-status-normalizer.service';
import { CreateBugReportService } from '../application/use-cases/bug-reports/create-bug-report.service';
import { DeleteBugReportService } from '../application/use-cases/bug-reports/delete-bug-report.service';
import { GetBugReportService } from '../application/use-cases/bug-reports/get-bug-report.service';
import { ListBugReportsService } from '../application/use-cases/bug-reports/list-bug-reports.service';
import { UpdateBugReportService } from '../application/use-cases/bug-reports/update-bug-report.service';
import { UpdateBugReportStatusService } from '../application/use-cases/bug-reports/update-bug-report-status.service';
import { BugReportCommentEntity } from '../infrastructure/persistence/typeorm/entities/bug-report-comment.entity';
import { BugReportEntity } from '../infrastructure/persistence/typeorm/entities/bug-report.entity';
import { BugReportCommentTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/bug-report-comment-typeorm.repository';
import { BugReportTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/bug-report-typeorm.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([BugReportEntity, BugReportCommentEntity]),
  ],
  providers: [
    BugReportTypeormRepository,
    BugReportCommentTypeormRepository,
    {
      provide: BUG_REPORT_REPOSITORY,
      useExisting: BugReportTypeormRepository,
    },
    {
      provide: BUG_REPORT_COMMENT_REPOSITORY,
      useExisting: BugReportCommentTypeormRepository,
    },
    {
      provide: BugReportStatusNormalizerService,
      useFactory: () => new BugReportStatusNormalizerService(),
    },
    {
      provide: ListBugReportsService,
      useFactory: (
        repo: BugReportRepository,
        normalizer: BugReportStatusNormalizerService,
      ) => new ListBugReportsService(repo, normalizer),
      inject: [BUG_REPORT_REPOSITORY, BugReportStatusNormalizerService],
    },
    {
      provide: GetBugReportService,
      useFactory: (
        repo: BugReportRepository,
        normalizer: BugReportStatusNormalizerService,
      ) => new GetBugReportService(repo, normalizer),
      inject: [BUG_REPORT_REPOSITORY, BugReportStatusNormalizerService],
    },
    {
      provide: CreateBugReportService,
      useFactory: (repo: BugReportRepository) =>
        new CreateBugReportService(repo),
      inject: [BUG_REPORT_REPOSITORY],
    },
    {
      provide: UpdateBugReportService,
      useFactory: (
        repo: BugReportRepository,
        getBugReport: GetBugReportService,
      ) => new UpdateBugReportService(repo, getBugReport),
      inject: [BUG_REPORT_REPOSITORY, GetBugReportService],
    },
    {
      provide: UpdateBugReportStatusService,
      useFactory: (
        repo: BugReportRepository,
        getBugReport: GetBugReportService,
        normalizer: BugReportStatusNormalizerService,
      ) => new UpdateBugReportStatusService(repo, getBugReport, normalizer),
      inject: [
        BUG_REPORT_REPOSITORY,
        GetBugReportService,
        BugReportStatusNormalizerService,
      ],
    },
    {
      provide: DeleteBugReportService,
      useFactory: (repo: BugReportRepository) =>
        new DeleteBugReportService(repo),
      inject: [BUG_REPORT_REPOSITORY],
    },
    {
      provide: CountBugReportCommentsService,
      useFactory: (repo: BugReportCommentRepository) =>
        new CountBugReportCommentsService(repo),
      inject: [BUG_REPORT_COMMENT_REPOSITORY],
    },
    {
      provide: ListBugReportCommentsService,
      useFactory: (repo: BugReportCommentRepository) =>
        new ListBugReportCommentsService(repo),
      inject: [BUG_REPORT_COMMENT_REPOSITORY],
    },
    {
      provide: AddBugReportCommentService,
      useFactory: (
        repo: BugReportCommentRepository,
        reports: BugReportRepository,
      ) => new AddBugReportCommentService(repo, reports),
      inject: [BUG_REPORT_COMMENT_REPOSITORY, BUG_REPORT_REPOSITORY],
    },
  ],
  exports: [
    ListBugReportsService,
    GetBugReportService,
    CreateBugReportService,
    UpdateBugReportService,
    UpdateBugReportStatusService,
    DeleteBugReportService,
    CountBugReportCommentsService,
    ListBugReportCommentsService,
    AddBugReportCommentService,
  ],
})
export class BugReportsModule {}
