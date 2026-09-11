import { BadRequestException } from '@nestjs/common';
import { AdminBugReportsService } from './admin-bug-reports.service';

describe('AdminBugReportsService', () => {
  function createDeps() {
    return {
      create: jest.fn(),
      list: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
      countComments: jest.fn(),
    };
  }

  it('enriches list items with commentsCount', async () => {
    const deps = createDeps();
    deps.list.mockResolvedValue([
      { id: 'r1', subject: 'A' },
      { id: 'r2', subject: 'B' },
    ]);
    deps.countComments.mockResolvedValue({ r1: 3 });
    const service = new AdminBugReportsService(deps as any);

    const result = await service.list();

    expect(result).toEqual([
      { id: 'r1', subject: 'A', commentsCount: 3 },
      { id: 'r2', subject: 'B', commentsCount: 0 },
    ]);
  });

  it('fails on get when the report does not exist', async () => {
    const deps = createDeps();
    deps.get.mockResolvedValue(null);
    const service = new AdminBugReportsService(deps as any);

    await expect(service.get('missing')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
