import { BadRequestException } from '@nestjs/common';
import { AdminBugReportsService } from './admin-bug-reports.service';

describe('AdminBugReportsService', () => {
  function createDeps() {
    return {
      createBugReport: { execute: jest.fn() },
      listBugReports: { execute: jest.fn() },
      getBugReport: { execute: jest.fn() },
      updateBugReport: { execute: jest.fn() },
      updateBugReportStatus: { execute: jest.fn() },
      deleteBugReport: { execute: jest.fn() },
      countBugReportComments: { execute: jest.fn() },
    };
  }

  it('enriches list items with commentsCount', async () => {
    const deps = createDeps();
    deps.listBugReports.execute.mockResolvedValue([
      { id: 'r1', subject: 'A' },
      { id: 'r2', subject: 'B' },
    ]);
    deps.countBugReportComments.execute.mockResolvedValue({ r1: 3 });
    const service = new AdminBugReportsService(
      deps.createBugReport as any,
      deps.listBugReports as any,
      deps.getBugReport as any,
      deps.updateBugReport as any,
      deps.updateBugReportStatus as any,
      deps.deleteBugReport as any,
      deps.countBugReportComments as any,
    );

    const result = await service.list();

    expect(result).toEqual([
      { id: 'r1', subject: 'A', commentsCount: 3 },
      { id: 'r2', subject: 'B', commentsCount: 0 },
    ]);
  });

  it('fails on get when the report does not exist', async () => {
    const deps = createDeps();
    deps.getBugReport.execute.mockResolvedValue(null);
    const service = new AdminBugReportsService(
      deps.createBugReport as any,
      deps.listBugReports as any,
      deps.getBugReport as any,
      deps.updateBugReport as any,
      deps.updateBugReportStatus as any,
      deps.deleteBugReport as any,
      deps.countBugReportComments as any,
    );

    await expect(service.get('missing')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
