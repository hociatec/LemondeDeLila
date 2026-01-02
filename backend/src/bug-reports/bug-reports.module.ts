import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BugReportEntity } from './entities/bug-report.entity';
import { BugReportsService } from './bug-reports.service';
import { BugReportCommentEntity } from './entities/bug-report-comment.entity';
import { BugReportCommentsService } from './bug-report-comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([BugReportEntity, BugReportCommentEntity])],
  providers: [BugReportsService, BugReportCommentsService],
  exports: [BugReportsService, BugReportCommentsService],
})
export class BugReportsModule {}
