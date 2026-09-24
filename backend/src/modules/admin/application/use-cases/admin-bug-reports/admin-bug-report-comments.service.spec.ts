import { BadRequestException } from '@nestjs/common';
import { AdminBugReportCommentsService } from './admin-bug-report-comments.service';

describe('AdminBugReportCommentsService', () => {
  const notifications = {
    notifyUser: jest.fn().mockResolvedValue(undefined),
    disconnectAll: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());
  it('lists comments for a report', async () => {
    const bugReports = {
      listComments: jest.fn().mockResolvedValue([
        {
          id: 'c1',
          createdAt: new Date('2026-08-20T10:00:00.000Z'),
        },
      ]),
      addComment: jest.fn(),
      countComments: jest.fn(),
    };
    const service = new AdminBugReportCommentsService(
      bugReports as any,
      notifications,
    );

    await expect(service.list('r1')).resolves.toEqual([
      {
        id: 'c1',
        createdAt: '2026-08-20T10:00:00.000Z',
      },
    ]);
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
    const service = new AdminBugReportCommentsService(
      {
        listComments: jest.fn(),
        addComment: jest.fn().mockResolvedValue(null),
        countComments: jest.fn(),
      } as any,
      notifications,
    );

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
      get: jest.fn().mockResolvedValue({ createdByUserId: 2 }),
      listComments: jest.fn(),
      addComment: jest.fn().mockResolvedValue({
        id: 'c1',
        createdAt: new Date('2026-08-20T10:00:00.000Z'),
      }),
      countComments: jest.fn().mockResolvedValue({ r1: 4 }),
    };
    const service = new AdminBugReportCommentsService(
      bugReports as any,
      notifications,
    );

    await expect(
      service.add({
        reportId: ' r1 ',
        content: 'note',
        createdByUserId: 1,
        createdByUsername: 'admin',
      }),
    ).resolves.toEqual({
      comment: { id: 'c1', createdAt: '2026-08-20T10:00:00.000Z' },
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
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      2,
      'bugReports.comment.added',
      {
        reportId: 'r1',
        commentId: 'c1',
        createdByUserId: 1,
      },
    );

    notifications.notifyUser.mockRejectedValueOnce(new Error('offline'));
    await expect(
      service.add({
        reportId: 'r1',
        content: 'second',
        createdByUserId: 1,
        createdByUsername: 'admin',
      }),
    ).resolves.toHaveProperty('comment.id', 'c1');
    notifications.notifyUser.mockClear();
    bugReports.get.mockResolvedValue({ createdByUserId: 1 });
    await service.add({
      reportId: 'r1',
      content: 'own',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });
});
