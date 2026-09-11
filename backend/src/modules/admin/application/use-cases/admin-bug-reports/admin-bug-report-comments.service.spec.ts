import { BadRequestException } from '@nestjs/common';
import { AdminBugReportCommentsService } from './admin-bug-report-comments.service';

describe('AdminBugReportCommentsService', () => {
  it('lists comments for a report', async () => {
    const bugReports = {
      listComments: jest.fn().mockResolvedValue([{ id: 'c1' }]),
      addComment: jest.fn(),
      countComments: jest.fn(),
    };
    const service = new AdminBugReportCommentsService(bugReports as any);

    await expect(service.list('r1')).resolves.toEqual([{ id: 'c1' }]);
    expect(bugReports.listComments).toHaveBeenCalledWith('r1', {
      offset: 0,
      limit: 50,
    });

    await service.list('r1', { offset: 10, limit: 20 });
    expect(bugReports.listComments).toHaveBeenLastCalledWith('r1', {
      offset: 10,
      limit: 20,
    });
  });

  it('throws when target report is missing', async () => {
    const service = new AdminBugReportCommentsService({
      listComments: jest.fn(),
      addComment: jest.fn().mockResolvedValue(null),
      countComments: jest.fn(),
    } as any);

    await expect(
      service.add({
        reportId: 'r1',
        content: 'note',
        createdByUserId: 1,
        createdByUsername: 'admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the created comment with updated count', async () => {
    const bugReports = {
      listComments: jest.fn(),
      addComment: jest.fn().mockResolvedValue({ id: 'c1' }),
      countComments: jest.fn().mockResolvedValue({ r1: 4 }),
    };
    const service = new AdminBugReportCommentsService(bugReports as any);

    await expect(
      service.add({
        reportId: ' r1 ',
        content: 'note',
        createdByUserId: 1,
        createdByUsername: 'admin',
      }),
    ).resolves.toEqual({
      comment: { id: 'c1' },
      reportId: 'r1',
      commentsCount: 4,
    });

    expect(bugReports.addComment).toHaveBeenCalledWith({
      reportId: 'r1',
      content: 'note',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });
    expect(bugReports.countComments).toHaveBeenCalledWith(['r1']);
  });
});
