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
      countByStatus: jest.fn(),
    };
  }

  it('enriches list items with commentsCount', async () => {
    const deps = createDeps();
    deps.list.mockResolvedValue([
      {
        id: 'r1',
        subject: 'A',
        createdAt: new Date('2026-08-20T10:00:00.000Z'),
        updatedAt: new Date('2026-08-21T10:00:00.000Z'),
      },
      {
        id: 'r2',
        subject: 'B',
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-23T10:00:00.000Z'),
      },
    ]);
    deps.countComments.mockResolvedValue({ r1: 3 });
    deps.countByStatus.mockResolvedValue({
      pending: 2,
      in_progress: 1,
      to_test: 4,
      refused: 0,
      rejected: 0,
    });
    const service = new AdminBugReportsService(deps as any);

    const result = await service.list({
      search: '  audio  ',
      status: 'pending',
    });

    expect(deps.list).toHaveBeenCalledWith({
      offset: 0,
      limit: 50,
      search: 'audio',
      status: 'pending',
    });
    expect(result).toEqual({
      items: [
        {
          id: 'r1',
          subject: 'A',
          commentsCount: 3,
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-21T10:00:00.000Z',
        },
        {
          id: 'r2',
          subject: 'B',
          commentsCount: 0,
          createdAt: '2026-08-22T10:00:00.000Z',
          updatedAt: '2026-08-23T10:00:00.000Z',
        },
      ],
      statusCounts: {
        pending: 2,
        in_progress: 1,
        to_test: 4,
        refused: 0,
        rejected: 0,
      },
    });
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
