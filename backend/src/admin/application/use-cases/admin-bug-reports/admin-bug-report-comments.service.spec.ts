import { BadRequestException } from '@nestjs/common';
import { AdminBugReportCommentsService } from './admin-bug-report-comments.service';

describe('AdminBugReportCommentsService', () => {
  it('lists comments for a report', async () => {
    const listBugReportComments = {
      execute: jest.fn().mockResolvedValue([{ id: 'c1' }]),
    };
    const service = new AdminBugReportCommentsService(
      listBugReportComments as any,
      { execute: jest.fn() } as any,
      { execute: jest.fn() } as any,
    );

    await expect(service.list('r1')).resolves.toEqual([{ id: 'c1' }]);
    expect(listBugReportComments.execute).toHaveBeenCalledWith('r1');
  });

  it('throws when target report is missing', async () => {
    const service = new AdminBugReportCommentsService(
      { execute: jest.fn() } as any,
      { execute: jest.fn().mockResolvedValue(null) } as any,
      { execute: jest.fn() } as any,
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
    const addBugReportComment = {
      execute: jest.fn().mockResolvedValue({ id: 'c1' }),
    };
    const countBugReportComments = {
      execute: jest.fn().mockResolvedValue({ r1: 4 }),
    };
    const service = new AdminBugReportCommentsService(
      { execute: jest.fn() } as any,
      addBugReportComment as any,
      countBugReportComments as any,
    );

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

    expect(addBugReportComment.execute).toHaveBeenCalledWith({
      reportId: 'r1',
      content: 'note',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });
    expect(countBugReportComments.execute).toHaveBeenCalledWith(['r1']);
  });
});
