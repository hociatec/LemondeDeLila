import { Global, Module } from '@nestjs/common';
import { BugReportsModule } from '../../modules/bug-reports/composition-api';
import { ADMIN_BUG_REPORTS_PORT } from '../../modules/admin/public-api';
import { AppAdminBugReportsAdapter } from './app-admin-bug-reports.adapter';

@Global()
@Module({
  imports: [BugReportsModule],
  providers: [
    AppAdminBugReportsAdapter,
    {
      provide: ADMIN_BUG_REPORTS_PORT,
      useExisting: AppAdminBugReportsAdapter,
    },
  ],
  exports: [ADMIN_BUG_REPORTS_PORT],
})
export class AppAdminBugReportsPortsModule {}
