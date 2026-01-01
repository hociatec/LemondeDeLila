import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BugReportEntity } from './entities/bug-report.entity';
import { BugReportsService } from './bug-reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([BugReportEntity])],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
